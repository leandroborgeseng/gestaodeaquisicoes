#!/usr/bin/env node
/**
 * fetch-fns-descriptives.js
 *
 * Busca o descritivo técnico de cada item no portal consultafns.saude.gov.br
 * usando o número SIAFÍSICO (= coItem) e salva em Item.descritivoFns no banco.
 *
 * API descoberta: GET /recursos/equipamento/{ano}/{coItem}/{coGrupo}/{coSubgrupo}
 * Onde coItem == SIAFÍSICO e coGrupo/coSubgrupo são geralmente 0.
 *
 * O campo salvo combina:
 *   - definicao (definição do equipamento)
 *   - especificacaoSugerida (especificação técnica sugerida pelo FNS)
 *
 * Uso:
 *   node scripts/fetch-fns-descriptives.js              # processa todos sem descritivoFns
 *   node scripts/fetch-fns-descriptives.js --limit=5    # testa com 5 itens
 *   node scripts/fetch-fns-descriptives.js --dry-run    # mostra sem salvar
 *   node scripts/fetch-fns-descriptives.js --force      # re-processa mesmo já tendo
 */

"use strict";

const https = require("https");
const qs    = require("querystring");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const FORCE   = args.includes("--force");
const LIMIT   = (() => {
  const m = args.find((a) => a.startsWith("--limit="));
  return m ? parseInt(m.split("=")[1], 10) : Infinity;
})();

const FNS_BASE = "https://consultafns.saude.gov.br";
const FNS_ANO  = 2025; // ano mais recente da tabela de referência

// ── Helpers ───────────────────────────────────────────────────────────────────
function log(msg) {
  process.stdout.write(`[${new Date().toTimeString().slice(0, 8)}] ${msg}\n`);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; hospital3colinas-bot/1.0)",
          Accept: "application/json, */*",
          Referer: FNS_BASE + "/",
        },
        timeout: 20000,
      },
      (res) => {
        // Follow one redirect
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, url).href;
          res.resume();
          return httpGet(next).then(resolve).catch(reject);
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf-8") })
        );
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("timeout")); });
  });
}

// ── FNS API calls ─────────────────────────────────────────────────────────────

/**
 * Strategy 1: Direct fetch by SIAFÍSICO (coItem), assuming coGrupo=0, coSubgrupo=0.
 * This works for ~95% of equipment items.
 */
async function fetchByCoItem(siaf, ano) {
  const url = `${FNS_BASE}/recursos/equipamento/${ano}/${siaf}/0/0`;
  const res = await httpGet(url);
  if (res.status !== 200) return null;
  try {
    const data = JSON.parse(res.body);
    return data.resultado ?? null;
  } catch {
    return null;
  }
}

/**
 * Strategy 2: Search by name then get detail.
 * Used as fallback when the SIAFÍSICO doesn't match coItem directly.
 */
async function fetchByName(nome, siaf, ano) {
  const params = qs.stringify({
    page: 1, count: 20, ano, abaAtiva: 1,
    nome, stPlanilha: false, stCardapio: false,
  });
  const res = await httpGet(`${FNS_BASE}/recursos/equipamento?${params}`);
  if (res.status !== 200) return null;

  let data;
  try { data = JSON.parse(res.body); } catch { return null; }

  const items = data.resultado?.itensPagina ?? [];
  // Find exact match by coItem == siaf, or best name match
  const match = items.find((i) => String(i.coItem) === String(siaf))
    ?? items.find((i) => i.descricao?.toLowerCase().includes(nome.toLowerCase().slice(0, 12)));

  if (!match) return null;

  // Fetch detail
  await sleep(400);
  const detailRes = await httpGet(
    `${FNS_BASE}/recursos/equipamento/${ano}/${match.coItem}/${match.coGrupo}/${match.coSubgrupo}`
  );
  if (detailRes.status !== 200) return null;
  try {
    const d = JSON.parse(detailRes.body);
    return d.resultado ?? null;
  } catch {
    return null;
  }
}

/**
 * Build the descritivoFns text from the API response object.
 * Combines definição + especificação sugerida.
 */
function buildDescritivo(obj) {
  const parts = [];
  if (obj.definicao?.trim()) {
    parts.push("DEFINIÇÃO:\n" + obj.definicao.trim());
  }
  if (obj.especificacaoSugerida?.trim()) {
    parts.push("ESPECIFICAÇÃO SUGERIDA FNS:\n" + obj.especificacaoSugerida.trim());
  }
  if (obj.definicaoBasica?.trim() && obj.definicaoBasica.trim() !== obj.especificacaoSugerida?.trim()) {
    parts.push("ORIENTAÇÃO DE ESPECIFICAÇÃO:\n" + obj.definicaoBasica.trim());
  }
  return parts.length ? parts.join("\n\n") : null;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log("=== fetch-fns-descriptives.js ===");
  log(`  dry-run: ${DRY_RUN} | force: ${FORCE} | limit: ${LIMIT === Infinity ? "∞" : LIMIT}`);

  const where = {
    numeroSiafisico: { not: null },
    ...(FORCE ? {} : { descritivoFns: null }),
  };

  const items = await prisma.item.findMany({
    where,
    select: { id: true, numero: true, equipamento: true, numeroSiafisico: true },
    orderBy: { numero: "asc" },
    ...(LIMIT < Infinity ? { take: LIMIT } : {}),
  });

  log(`  ${items.length} itens a processar`);
  if (items.length === 0) { await prisma.$disconnect(); return; }

  let ok = 0, fail = 0;

  for (const item of items) {
    const siaf = item.numeroSiafisico;
    log(`\n[${item.numero}] ${item.equipamento} (SIAF ${siaf})`);

    let result = null;

    // Strategy 1: direct fetch
    try {
      result = await fetchByCoItem(siaf, FNS_ANO);
      if (result) log(`  → estratégia 1 (coItem direto)`);
    } catch (e) {
      log(`  [WARN] estratégia 1 falhou: ${e.message}`);
    }

    // Strategy 2: search by name fallback
    if (!result) {
      await sleep(400);
      try {
        result = await fetchByName(item.equipamento, siaf, FNS_ANO);
        if (result) log(`  → estratégia 2 (busca por nome)`);
      } catch (e) {
        log(`  [WARN] estratégia 2 falhou: ${e.message}`);
      }
    }

    if (!result) {
      log(`  [FAIL] nenhum dado encontrado para SIAF ${siaf}`);
      fail++;
    } else {
      const texto = buildDescritivo(result);
      if (!texto) {
        log(`  [WARN] API retornou dados mas sem texto de descritivo`);
        log(`         campos: ${Object.keys(result).join(", ")}`);
        fail++;
      } else {
        const preview = texto.replace(/\n/g, " ").slice(0, 120);
        log(`  descritivo (${texto.length} chars): "${preview}…"`);

        if (!DRY_RUN) {
          await prisma.item.update({
            where: { id: item.id },
            data: { descritivoFns: texto },
          });
          log(`  → salvo no banco`);
        } else {
          log(`  → dry-run, não salvo`);
        }
        ok++;
      }
    }

    // Polite delay between requests (600ms)
    await sleep(600);
  }

  log(`\n=== Resultado ===`);
  log(`  OK   : ${ok}`);
  log(`  Falha: ${fail}`);

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
