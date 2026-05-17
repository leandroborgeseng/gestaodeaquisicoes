/**
 * download-drive-files.js — CommonJS, sem TypeScript, sem ts-node
 *
 * Baixa PDFs de especificações técnicas e cotações do Google Drive
 * para o volume /data/uploads/ e cria registros Anexo no banco.
 *
 * Chamado pelo start.sh em background:
 *   node scripts/download-drive-files.js >> /data/download.log 2>&1 &
 *
 * Flags:
 *   --specs-only      Só especificações
 *   --cotacoes-only   Só cotações
 *   --dry-run         Simula sem baixar
 *   --limit=N         Processa só N arquivos
 */

"use strict";

const { PrismaClient } = require("@prisma/client");
const https = require("https");
const http  = require("http");
const fs    = require("fs");
const path  = require("path");

const prisma      = new PrismaClient();
const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), ".uploads");

const args      = process.argv.slice(2);
const DRY_RUN   = args.includes("--dry-run");
const DO_SPECS  = !args.includes("--cotacoes-only");
const DO_COTAS  = !args.includes("--specs-only");
const LIMIT_ARG = args.find((a) => a.startsWith("--limit="));
const LIMIT     = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : Infinity;
const DELAY_MS  = 400; // polite delay between downloads

let downloaded = 0, skipped = 0, failed = 0, total = 0;

// ─── helpers ────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write("[" + new Date().toISOString().slice(11, 19) + "] " + msg + "\n");
}

function driveFileId(url) {
  const m = url && url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function driveDownloadUrl(fileId) {
  return "https://drive.usercontent.google.com/download?id=" + fileId + "&export=download";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fileExists(p) {
  return fs.promises.access(p).then(() => true).catch(() => false);
}

function fetchBuffer(url, redirects) {
  redirects = redirects || 0;
  return new Promise(function (resolve, reject) {
    if (redirects > 6) { reject(new Error("Too many redirects")); return; }
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AionBot/1.0)",
        "Accept":     "application/pdf,*/*",
      },
    }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchBuffer(res.headers.location, redirects + 1));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " — " + url.slice(0, 80)));
        return;
      }
      const chunks = [];
      res.on("data", function (c) { chunks.push(c); });
      res.on("end",  function () { resolve(Buffer.concat(chunks)); });
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function downloadOne(opts) {
  const { driveUrl, savePath, nomeOriginal, itemId, orcamentoId, adminId } = opts;
  total++;

  if (await fileExists(savePath)) {
    skipped++;
    return "skip";
  }

  const fileId = driveFileId(driveUrl);
  if (!fileId) { log("  [WARN] Sem file ID: " + driveUrl); failed++; return "fail"; }

  if (DRY_RUN) {
    log("  [DRY]  " + savePath);
    downloaded++;
    return "ok";
  }

  try {
    const buffer = await fetchBuffer(driveDownloadUrl(fileId));

    // Verifica se é realmente um PDF
    if (buffer.slice(0, 4).toString() !== "%PDF") {
      log("  [WARN] Não é PDF: " + nomeOriginal + " (" + buffer.slice(0, 8).toString("hex") + ")");
      failed++;
      return "fail";
    }

    await fs.promises.mkdir(path.dirname(savePath), { recursive: true });
    await fs.promises.writeFile(savePath, buffer);

    // URL relativa para servir via /api/files/
    const relPath  = path.relative(path.join(UPLOAD_ROOT, "uploads"), savePath);
    const serveUrl = "/api/files/" + relPath.split(path.sep).join("/");
    const nome     = path.basename(savePath);

    const existing = await prisma.anexo.findFirst({ where: { url: serveUrl } });
    if (!existing) {
      await prisma.anexo.create({
        data: Object.assign(
          { nome, nomeOriginal, mimeType: "application/pdf", tamanho: buffer.length,
            url: serveUrl, bucket: "local", autorId: adminId, itemId },
          orcamentoId ? { orcamentoId } : {}
        ),
      });
    }

    downloaded++;
    return "ok";
  } catch (err) {
    log("  [FAIL] " + nomeOriginal.slice(0, 60) + ": " + err.message);
    failed++;
    return "fail";
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  log("═══════════════════════════════════════════════════════");
  log(" AION — Download Google Drive  (UPLOAD_ROOT=" + UPLOAD_ROOT + ")");
  log(" DRY=" + DRY_RUN + "  SPECS=" + DO_SPECS + "  COTAS=" + DO_COTAS + "  LIMIT=" + LIMIT);
  log("═══════════════════════════════════════════════════════");

  // Precisa de um usuário ADMIN para criar os Anexos
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) {
    log("[FATAL] Nenhum usuário ADMIN encontrado. Rode o seed antes.");
    process.exit(1);
  }
  const adminId = admin.id;
  let processed = 0;

  // ── Especificações técnicas ────────────────────────────────────────────
  if (DO_SPECS) {
    log("▸ Especificações técnicas…");
    const items = await prisma.item.findMany({
      where:  { especificacaoUrl: { not: null } },
      select: { id: true, numero: true, equipamento: true, especificacaoUrl: true },
    });

    for (const item of items) {
      if (processed >= LIMIT) break;
      processed++;

      const savePath     = path.join(UPLOAD_ROOT, "uploads", item.numero, "especificacao", "especificacao-tecnica.pdf");
      const nomeOriginal = "Especificação técnica — " + item.equipamento + ".pdf";
      const result       = await downloadOne({ driveUrl: item.especificacaoUrl, savePath, nomeOriginal, itemId: item.id, adminId });
      const sym          = result === "ok" ? "✓" : result === "skip" ? "·" : "✗";
      if (result !== "skip") log("  " + sym + " [" + processed + "/" + items.length + "] " + item.numero + " " + item.equipamento.slice(0, 45));
      if (result === "ok") await sleep(DELAY_MS);
    }

    log("  Especificações: " + downloaded + " baixadas, " + skipped + " já existiam, " + failed + " falhas");
  }

  const specDownloaded = downloaded, specSkipped = skipped, specFailed = failed;
  downloaded = 0; skipped = 0; failed = 0;

  // ── Cotações ──────────────────────────────────────────────────────────
  if (DO_COTAS) {
    log("▸ Cotações de fornecedores…");
    const orcs = await prisma.orcamento.findMany({
      where:  { cotacaoUrl: { not: null } },
      select: {
        id: true, numero: true, cotacaoUrl: true,
        item:       { select: { id: true, numero: true, equipamento: true } },
        fornecedor: { select: { nome: true } },
      },
    });

    for (const orc of orcs) {
      if (processed >= LIMIT) break;
      processed++;

      const safeForn     = orc.fornecedor.nome.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 40);
      const fileName     = "cotacao-" + orc.numero + "-" + safeForn + ".pdf";
      const savePath     = path.join(UPLOAD_ROOT, "uploads", orc.item.numero, "cotacao", fileName);
      const nomeOriginal = "Cotação " + orc.numero + " — " + orc.fornecedor.nome + " — " + orc.item.equipamento + ".pdf";
      const result       = await downloadOne({ driveUrl: orc.cotacaoUrl, savePath, nomeOriginal, itemId: orc.item.id, orcamentoId: orc.id, adminId });
      const sym          = result === "ok" ? "✓" : result === "skip" ? "·" : "✗";
      if (result !== "skip") log("  " + sym + " [" + processed + "] " + orc.item.numero + " Orc." + orc.numero + " " + orc.fornecedor.nome.slice(0, 25));
      if (result === "ok") await sleep(DELAY_MS);
    }

    log("  Cotações: " + downloaded + " baixadas, " + skipped + " já existiam, " + failed + " falhas");
  }

  log("═══════════════════════════════════════════════════════");
  log(" TOTAL  specs : baixadas=" + specDownloaded + " existiam=" + specSkipped + " falhas=" + specFailed);
  log(" TOTAL  cotas : baixadas=" + downloaded + " existiam=" + skipped + " falhas=" + failed);
  log("═══════════════════════════════════════════════════════");
}

main()
  .catch(function (e) { log("[ERROR] " + e.message); process.exit(1); })
  .finally(function () { return prisma.$disconnect(); });
