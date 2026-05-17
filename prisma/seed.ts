import { PrismaClient, StatusProcesso, StatusVsReferencia } from "@prisma/client";
import bcrypt from "bcryptjs";
import rawData from "../seed/equipamentos.json";
import rawLinks from "../seed/drive_links.json";
import rawCotacaoLinks from "../seed/cotacao_links.json";

const prisma = new PrismaClient();

const data = rawData as {
  fornecedores: { nome: string; cnpj: string | null; email: string | null; telefone: string | null }[];
  itens: {
    id: number;
    equipamento: string;
    descritivo_renem?: string;
    especificacao?: string;
    numero_siafisico?: string | number | null;
    valor_referencia_fns?: number | null;
    presenca_em_ata?: string | null;
    orcamentos?: { empresa: string; valor: number | null }[];
    origem_menor_valor?: string | null;
    menor_valor_unitario?: number | null;
    status_vs_referencia_fns?: string | null;
    fase_unica_qtd?: number | null;
    fase_unica_valor_total?: number | null;
    status_processo?: string | null;
    contratacao?: { fornecedor?: string; valor?: number | null } | null;
  }[];
};

const driveLinksMap = new Map<string, string>(
  (rawLinks as { drive_links: { equipamento: string; url: string }[] })
    .drive_links.map((d) => [d.equipamento, d.url])
);

// cotacaoLinksMap: key = "equipamento|orcamento_numero" → url
const cotacaoLinksMap = new Map<string, string>(
  (rawCotacaoLinks as { cotacao_links: { equipamento: string; orcamento: number; url: string }[] })
    .cotacao_links.map((c) => [`${c.equipamento}|${c.orcamento}`, c.url])
);

function toVsRef(val: string | null | undefined): StatusVsReferencia | null {
  if (!val) return null;
  const normalized = val.toUpperCase().replace(/\s+/g, "_");
  const MAP: Record<string, StatusVsReferencia> = {
    ABAIXO_DO_VALOR: "ABAIXO_DO_VALOR",
    ACIMA_DO_VALOR: "ACIMA_DO_VALOR",
    NAO_SE_APLICA: "NAO_SE_APLICA",
    "NÃO_SE_APLICA": "NAO_SE_APLICA",
  };
  return MAP[normalized] ?? null;
}

function toStatus(val: string | null | undefined): StatusProcesso {
  const MAP: Record<string, StatusProcesso> = {
    PENDENTE: "PENDENTE",
    COTACAO_EM_ANDAMENTO: "COTACAO_EM_ANDAMENTO",
    COTACAO_CONCLUIDA: "COTACAO_CONCLUIDA",
    CONTRATADO: "CONTRATADO",
    ENTREGA_PARCIAL: "ENTREGA_PARCIAL",
    ENTREGUE: "ENTREGUE",
    NF_RECEBIDA: "NF_RECEBIDA",
    EM_TESTE: "EM_TESTE",
    CONCLUIDO: "CONCLUIDO",
    CANCELADO: "CANCELADO",
  };
  return (val && MAP[val]) ? MAP[val] : "PENDENTE";
}

function toNumero(id: number): string {
  // id starts at -1, so we offset: EQ-001 = id -1, EQ-002 = id 0, etc.
  const seq = id + 2; // -1 → 1, 0 → 2, 1 → 3 ...
  return `EQ-${String(seq).padStart(3, "0")}`;
}

async function main() {
  console.log("🌱 Seeding database...");

  // 1. Upsert fornecedores
  const fornecedoresMap = new Map<string, string>();
  for (const f of data.fornecedores) {
    const nome = f.nome.trim();
    const created = await prisma.fornecedor.upsert({
      where: { nome },
      create: { nome, cnpj: f.cnpj ?? null, email: f.email ?? null, telefone: f.telefone ?? null },
      update: {},
    });
    fornecedoresMap.set(nome, created.id);
  }
  console.log(`✓ ${data.fornecedores.length} fornecedores`);

  // 2. Create items with orcamentos and contratacao
  let itemCount = 0;
  for (const item of data.itens) {
    const numero = toNumero(item.id);
    const siafisicoRaw = item.numero_siafisico != null
      ? String(item.numero_siafisico).replace(/,/g, "").trim()
      : null;
    const siafisico = siafisicoRaw ? parseInt(siafisicoRaw, 10) || null : null;

    const especificacaoUrl = driveLinksMap.get(item.equipamento) ?? null;

    const created = await prisma.item.upsert({
      where: { numero },
      create: {
        numero,
        equipamento: item.equipamento,
        descritivoRenem: item.descritivo_renem ?? null,
        especificacao: item.especificacao ?? null,
        especificacaoUrl,
        numeroSiafisico: siafisico,
        valorReferenciaFns: item.valor_referencia_fns ?? null,
        presencaEmAta: item.presenca_em_ata === "SIM",
        origemMenorValor: item.origem_menor_valor ?? null,
        menorValorUnitario: item.menor_valor_unitario ?? null,
        statusVsReferenciaFns: toVsRef(item.status_vs_referencia_fns),
        faseUnicaQtd: item.fase_unica_qtd ?? 1,
        faseUnicaValorTotal: item.fase_unica_valor_total ?? null,
        statusProcesso: toStatus(item.status_processo),
      },
      update: { especificacaoUrl },
    });

    // Orcamentos
    const orcamentos = item.orcamentos ?? [];
    for (let i = 0; i < orcamentos.length; i++) {
      const orc = orcamentos[i];
      const empresa = String(orc.empresa ?? "").trim();
      if (!empresa || orc.valor == null) continue;

      // Ensure fornecedor exists (some orcamento companies may not be in the main list)
      let fornId = fornecedoresMap.get(empresa);
      if (!fornId) {
        const f = await prisma.fornecedor.upsert({
          where: { nome: empresa },
          create: { nome: empresa },
          update: {},
        });
        fornId = f.id;
        fornecedoresMap.set(empresa, fornId);
      }

      const orcNum = i + 1;
      const cotacaoUrl = cotacaoLinksMap.get(`${item.equipamento}|${orcNum}`) ?? null;
      const orcId = `${created.id}-orc-${orcNum}`;
      await prisma.orcamento.upsert({
        where: { id: orcId },
        create: {
          id: orcId,
          itemId: created.id,
          fornecedorId: fornId,
          valor: orc.valor,
          numero: orcNum,
          cotacaoUrl,
          dataOrcamento: null,
        },
        update: { cotacaoUrl },
      });
    }

    // Contratacao
    if (item.contratacao?.fornecedor) {
      const empresa = String(item.contratacao.fornecedor).trim();
      let fornId = fornecedoresMap.get(empresa);
      if (!fornId) {
        const f = await prisma.fornecedor.upsert({
          where: { nome: empresa },
          create: { nome: empresa },
          update: {},
        });
        fornId = f.id;
        fornecedoresMap.set(empresa, fornId);
      }
      const existing = await prisma.contratacao.findUnique({ where: { itemId: created.id } });
      if (!existing) {
        await prisma.contratacao.create({
          data: {
            itemId: created.id,
            fornecedorId: fornId,
            valorContratado: item.contratacao.valor ?? item.fase_unica_valor_total ?? undefined,
          },
        });
      }
    }

    itemCount++;
  }
  console.log(`✓ ${itemCount} itens`);

  // 3. Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@hospital3colinas.com.br";
  const adminPass = process.env.ADMIN_PASSWORD ?? "changeme123";
  await prisma.user.upsert({
    where: { email: adminEmail },
    create: {
      name: "Administrador FAEPA",
      email: adminEmail,
      role: "ADMIN",
      password: await bcrypt.hash(adminPass, 12),
    },
    update: {},
  });
  console.log(`✓ Admin: ${adminEmail}`);

  // 4. Hospital user
  await prisma.user.upsert({
    where: { email: "julia.tavares@3colinas.sp.gov.br" },
    create: {
      name: "Júlia Tavares",
      email: "julia.tavares@3colinas.sp.gov.br",
      role: "HOSPITAL",
      password: await bcrypt.hash("hospital123", 12),
    },
    update: {},
  });

  // 5. Fornecedor user — linked to first available supplier
  const firstForn = data.fornecedores[0];
  if (firstForn) {
    const fornId = fornecedoresMap.get(firstForn.nome.trim());
    if (fornId) {
      await prisma.user.upsert({
        where: { email: "fornecedor@example.com" },
        create: {
          name: "Usuário Fornecedor",
          email: "fornecedor@example.com",
          role: "FORNECEDOR",
          fornecedorId: fornId,
          password: await bcrypt.hash("fornecedor123", 12),
        },
        update: {},
      });
    }
  }

  console.log("✓ Demo users created");
  console.log("✅ Seed complete");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
