import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

const STATUS_PT: Record<string, string> = {
  PENDENTE:               "Pendente",
  COTACAO_EM_ANDAMENTO:   "Cotação em andamento",
  COTACAO_CONCLUIDA:      "Cotação concluída",
  CONTRATADO:             "Contratado",
  ENTREGA_PARCIAL:        "Entrega parcial",
  ENTREGUE:               "Entregue",
  NF_RECEBIDA:            "NF recebida",
  EM_TESTE:               "Em teste",
  CONCLUIDO:              "Concluído",
  CANCELADO:              "Cancelado",
};

const CAT_PT: Record<string, string> = {
  MEDICO_HOSPITALAR: "Médico-Hospitalar",
  TI:                "Tecnologia da Informação",
  MOBILIARIO:        "Mobiliário",
};

const PRIO_PT: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA:    "Alta",
  MEDIA:   "Média",
  BAIXA:   "Baixa",
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("pt-BR");
}

function fmtBRL(v: number | null | undefined) {
  if (v == null) return "";
  return v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deadlineDate(dataAssinatura: Date | null, prazoEntregaDias: number | null): Date | null {
  if (!dataAssinatura || !prazoEntregaDias) return null;
  const d = new Date(dataAssinatura);
  d.setDate(d.getDate() + prazoEntregaDias);
  return d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new NextResponse("Não autorizado", { status: 401 });

  const sp = req.nextUrl.searchParams;
  const cat        = sp.get("categoria") ?? "MEDICO_HOSPITALAR";
  const status     = sp.get("status");
  const vsRef      = sp.get("vsRef");
  const setorId    = sp.get("setor");
  const faseId     = sp.get("fase");
  const prioridade = sp.get("prioridade");
  const q          = sp.get("q");
  const ata        = sp.get("ata");
  const atrasado   = sp.get("atrasado");

  const where: Record<string, unknown> = {};
  if (cat && cat !== "all") where.categoria = cat;
  if (status && status !== "all") where.statusProcesso = status;
  if (vsRef && vsRef !== "all") where.statusVsReferenciaFns = vsRef;
  if (setorId && setorId !== "all") where.setorId = setorId;
  if (faseId === "none") where.faseCompraId = null;
  else if (faseId && faseId !== "all") where.faseCompraId = faseId;
  if (prioridade && prioridade !== "all") where.prioridade = prioridade;
  if (ata === "true") where.presencaEmAta = true;
  if (q) {
    where.OR = [
      { equipamento: { contains: q, mode: "insensitive" } },
      { numero: { contains: q, mode: "insensitive" } },
    ];
  }

  // Atrasado filter: items in CONTRATADO/ENTREGA_PARCIAL with expired deadline
  if (atrasado === "true") {
    const today = new Date();
    const atrasadoIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT i.id FROM "Item" i
      JOIN "Contratacao" c ON c."itemId" = i.id
      WHERE i."statusProcesso" IN ('CONTRATADO', 'ENTREGA_PARCIAL')
        AND c."prazoEntregaDias" IS NOT NULL
        AND c."dataAssinatura" IS NOT NULL
        AND c."dataAssinatura" + (c."prazoEntregaDias" * INTERVAL '1 day') < ${today}
    `;
    const ids = atrasadoIds.map((r) => r.id);
    where.id = { in: ids };
  }

  const items = await prisma.item.findMany({
    where,
    orderBy: { numero: "asc" },
    include: {
      setor: { select: { nome: true, sigla: true } },
      faseCompra: { select: { nome: true } },
      contratacao: {
        include: { fornecedor: { select: { nome: true, cnpj: true } } },
      },
      notasFiscais: { select: { numero: true, dataEmissao: true, valor: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  const today = new Date();

  const rows = items.map((item) => {
    const contratacao = item.contratacao;
    const prazoVencido = (() => {
      if (!contratacao?.dataAssinatura || !contratacao.prazoEntregaDias) return false;
      const dl = deadlineDate(contratacao.dataAssinatura, contratacao.prazoEntregaDias);
      return dl ? dl < today && !["ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"].includes(item.statusProcesso) : false;
    })();

    return {
      "Nº Item":             item.numero,
      "SIAFÍSICO":           item.numeroSiafisico ?? "",
      "Equipamento":         item.equipamento,
      "Categoria":           CAT_PT[item.categoria ?? ""] ?? item.categoria ?? "",
      "Setor":               item.setor?.sigla ?? item.setor?.nome ?? "",
      "Fase de compra":      item.faseCompra?.nome ?? "",
      "Status":              STATUS_PT[item.statusProcesso] ?? item.statusProcesso,
      "Prioridade":          PRIO_PT[item.prioridade ?? ""] ?? "",
      "Prazo vencido":       prazoVencido ? "SIM" : "",
      "Em ATA":              item.presencaEmAta ? "SIM" : "",
      "Qtd":                 item.faseUnicaQtd ?? "",
      "Ref. FNS (unit, R$)": item.valorReferenciaFns ? fmtBRL(Number(item.valorReferenciaFns)) : "",
      "Valor total (R$)":    item.faseUnicaValorTotal ? fmtBRL(Number(item.faseUnicaValorTotal)) : "",
      "Vs FNS":              item.statusVsReferenciaFns === "ABAIXO_DO_VALOR" ? "Abaixo" : item.statusVsReferenciaFns === "ACIMA_DO_VALOR" ? "Acima" : "",
      "Fornecedor":          contratacao?.fornecedor?.nome ?? "",
      "CNPJ Fornecedor":     contratacao?.fornecedor?.cnpj ?? "",
      "Nº Contrato":         contratacao?.numeroContrato ?? "",
      "Valor contratado (R$)": contratacao?.valorContratado ? fmtBRL(Number(contratacao.valorContratado)) : "",
      "Data assinatura":     fmtDate(contratacao?.dataAssinatura),
      "Vigência":            fmtDate(contratacao?.dataVigencia),
      "Prazo entrega (dias)": contratacao?.prazoEntregaDias ?? "",
      "Prazo entrega (data)": contratacao?.dataAssinatura && contratacao.prazoEntregaDias
        ? fmtDate(deadlineDate(contratacao.dataAssinatura, contratacao.prazoEntregaDias))
        : "",
      "Nº NF":               item.notasFiscais[0]?.numero ?? "",
      "Data NF":             fmtDate(item.notasFiscais[0]?.dataEmissao),
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = [
    { wch: 8 }, { wch: 10 }, { wch: 40 }, { wch: 22 }, { wch: 14 }, { wch: 20 },
    { wch: 22 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 6 },
    { wch: 18 }, { wch: 18 }, { wch: 10 }, { wch: 28 }, { wch: 20 },
    { wch: 18 }, { wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 18 },
    { wch: 20 }, { wch: 10 }, { wch: 12 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Itens");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `itens_3colinas_${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
