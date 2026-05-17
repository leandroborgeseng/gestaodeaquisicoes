/**
 * Downloads all Google Drive PDFs (specifications + quotations) and stores them
 * in the volume at UPLOAD_DIR, then creates Anexo records in the database.
 *
 * Run on Railway:
 *   railway run npx ts-node --project tsconfig.json scripts/download-drive-files.ts
 *
 * Run locally (saves to .uploads/):
 *   npx ts-node --project tsconfig.json scripts/download-drive-files.ts
 *
 * Flags:
 *   --specs-only      Only download specification PDFs
 *   --cotacoes-only   Only download quotation PDFs
 *   --dry-run         Show what would be downloaded without doing it
 *   --limit=N         Process only N files (useful for testing)
 */

import { PrismaClient } from "@prisma/client";
import { writeFile, mkdir, access } from "fs/promises";
import path from "path";
import https from "https";
import http from "http";

const prisma = new PrismaClient();
const UPLOAD_ROOT = process.env.UPLOAD_DIR ?? path.join(process.cwd(), ".uploads");

const args     = process.argv.slice(2);
const DRY_RUN  = args.includes("--dry-run");
const SPECS    = !args.includes("--cotacoes-only");
const COTACOES = !args.includes("--specs-only");
const LIMIT    = (() => { const l = args.find((a) => a.startsWith("--limit=")); return l ? parseInt(l.split("=")[1], 10) : Infinity; })();

// Stats
let downloaded = 0, skipped = 0, failed = 0, total = 0;

// ─── Google Drive helpers ────────────────────────────────────────────────────

function driveFileId(url: string): string | null {
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function downloadUrl(fileId: string): string {
  return `https://drive.usercontent.google.com/download?id=${fileId}&export=download`;
}

function fetchBuffer(url: string): Promise<{ buffer: Buffer; contentType: string; size: number }> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;

    function doRequest(reqUrl: string, redirects = 0): void {
      if (redirects > 5) { reject(new Error("Too many redirects")); return; }

      lib.get(reqUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AionDownloader/1.0)",
          "Accept": "application/pdf,*/*",
        },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          doRequest(res.headers.location, redirects + 1);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${reqUrl}`));
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer,
            contentType: res.headers["content-type"] ?? "application/octet-stream",
            size: buffer.length,
          });
        });
        res.on("error", reject);
      }).on("error", reject);
    }

    doRequest(url);
  });
}

async function fileExists(p: string): Promise<boolean> {
  try { await access(p); return true; } catch { return false; }
}

// ─── Admin user for Anexo.autorId ───────────────────────────────────────────

async function getAdminId(): Promise<string> {
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, select: { id: true } });
  if (!admin) throw new Error("No ADMIN user found in database. Run seed first.");
  return admin.id;
}

// ─── Download one file ───────────────────────────────────────────────────────

async function downloadOne(opts: {
  driveUrl:    string;
  savePath:    string;
  nomeOriginal: string;
  itemId:      string;
  orcamentoId?: string;
  adminId:     string;
}): Promise<"ok" | "skip" | "fail"> {
  const { driveUrl, savePath, nomeOriginal, itemId, orcamentoId, adminId } = opts;

  // Skip if already downloaded
  if (await fileExists(savePath)) {
    skipped++;
    return "skip";
  }

  const fileId = driveFileId(driveUrl);
  if (!fileId) { failed++; return "fail"; }

  if (DRY_RUN) {
    console.log(`  [DRY] Would download → ${savePath}`);
    downloaded++;
    return "ok";
  }

  try {
    const { buffer, size } = await fetchBuffer(downloadUrl(fileId));

    // Verify it's actually a PDF
    if (buffer.slice(0, 4).toString() !== "%PDF") {
      console.warn(`  [WARN] Not a PDF: ${nomeOriginal} (got ${buffer.slice(0, 20).toString("hex")})`);
      failed++;
      return "fail";
    }

    await mkdir(path.dirname(savePath), { recursive: true });
    await writeFile(savePath, buffer);

    // URL path served by /api/files/
    const relPath  = path.relative(path.join(UPLOAD_ROOT, "uploads"), savePath);
    const serveUrl = `/api/files/${relPath}`;
    const nome     = path.basename(savePath);

    // Check if Anexo already exists to avoid duplicates
    const existing = await prisma.anexo.findFirst({ where: { url: serveUrl } });
    if (!existing) {
      await prisma.anexo.create({
        data: {
          nome,
          nomeOriginal,
          mimeType:    "application/pdf",
          tamanho:     size,
          url:         serveUrl,
          bucket:      "local",
          autorId:     adminId,
          itemId,
          ...(orcamentoId ? { orcamentoId } : {}),
        },
      });
    }

    downloaded++;
    return "ok";
  } catch (err) {
    console.error(`  [FAIL] ${nomeOriginal}: ${(err as Error).message}`);
    failed++;
    return "fail";
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log(" AION — Download de arquivos Google Drive");
  console.log("═══════════════════════════════════════════════════════");
  console.log(` UPLOAD_ROOT : ${UPLOAD_ROOT}`);
  console.log(` DRY_RUN     : ${DRY_RUN}`);
  console.log(` SPECS       : ${SPECS}`);
  console.log(` COTACOES    : ${COTACOES}`);
  console.log(` LIMIT       : ${LIMIT === Infinity ? "none" : LIMIT}`);
  console.log();

  const adminId = await getAdminId();
  let processed = 0;

  // ── Specifications ──────────────────────────────────────────────────────
  if (SPECS) {
    console.log("▸ Downloading specification PDFs…");
    const items = await prisma.item.findMany({
      where:  { especificacaoUrl: { not: null } },
      select: { id: true, numero: true, equipamento: true, especificacaoUrl: true },
    });

    for (const item of items) {
      if (processed >= LIMIT) break;
      total++;
      processed++;

      const savePath    = path.join(UPLOAD_ROOT, "uploads", item.numero, "especificacao", "especificacao-tecnica.pdf");
      const nomeOriginal = `Especificação técnica - ${item.equipamento}.pdf`;

      const result = await downloadOne({
        driveUrl:    item.especificacaoUrl!,
        savePath,
        nomeOriginal,
        itemId:      item.id,
        adminId,
      });

      const symbol = result === "ok" ? "✓" : result === "skip" ? "·" : "✗";
      if (result !== "skip" || processed % 20 === 0) {
        console.log(`  ${symbol} [${processed}/${items.length}] ${item.numero} — ${item.equipamento.slice(0, 50)}`);
      }

      // Small delay to be polite to Google's servers
      if (result === "ok") await new Promise((r) => setTimeout(r, 300));
    }
    console.log();
  }

  // ── Quotations ──────────────────────────────────────────────────────────
  if (COTACOES) {
    console.log("▸ Downloading quotation PDFs…");
    const orcamentos = await prisma.orcamento.findMany({
      where:  { cotacaoUrl: { not: null } },
      select: {
        id:          true,
        numero:      true,
        cotacaoUrl:  true,
        item:        { select: { id: true, numero: true, equipamento: true } },
        fornecedor:  { select: { nome: true } },
      },
    });

    for (const orc of orcamentos) {
      if (processed >= LIMIT) break;
      total++;
      processed++;

      const safeForn    = orc.fornecedor.nome.replace(/[^a-zA-Z0-9\-_]/g, "_").slice(0, 40);
      const fileName    = `cotacao-${orc.numero}-${safeForn}.pdf`;
      const savePath    = path.join(UPLOAD_ROOT, "uploads", orc.item.numero, "cotacao", fileName);
      const nomeOriginal = `Cotação ${orc.numero} - ${orc.fornecedor.nome} - ${orc.item.equipamento}.pdf`;

      const result = await downloadOne({
        driveUrl:    orc.cotacaoUrl!,
        savePath,
        nomeOriginal,
        itemId:      orc.item.id,
        orcamentoId: orc.id,
        adminId,
      });

      const symbol = result === "ok" ? "✓" : result === "skip" ? "·" : "✗";
      if (result !== "skip" || processed % 30 === 0) {
        console.log(`  ${symbol} [${processed}] ${orc.item.numero} Orc.${orc.numero} ${orc.fornecedor.nome.slice(0, 25)}`);
      }

      if (result === "ok") await new Promise((r) => setTimeout(r, 300));
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════");
  console.log(` Total     : ${total}`);
  console.log(` Downloaded: ${downloaded}`);
  console.log(` Skipped   : ${skipped}  (already existed)`);
  console.log(` Failed    : ${failed}`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
