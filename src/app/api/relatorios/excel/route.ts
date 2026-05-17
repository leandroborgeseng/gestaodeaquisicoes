import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const itens = await prisma.item.findMany({
    orderBy: { numero: "asc" },
    include: {
      setor:       { select: { nome: true, sigla: true } },
      faseCompra:  { select: { nome: true } },
      contratacao: { include: { fornecedor: { select: { nome: true } } } },
      orcamentos:  { orderBy: { numero: "asc" }, include: { fornecedor: { select: { nome: true } } } },
    },
  });

  const STATUS_PT: Record<string, string> = {
    PENDENTE:              "Pendente",
    COTACAO_EM_ANDAMENTO:  "Cotação em andamento",
    COTACAO_CONCLUIDA:     "Cotação concluída",
    CONTRATADO:            "Contratado",
    ENTREGA_PARCIAL:       "Entrega parcial",
    ENTREGUE:              "Entregue",
    NF_RECEBIDA:           "NF recebida",
    EM_TESTE:              "Em teste",
    CONCLUIDO:             "Concluído",
    CANCELADO:             "Cancelado",
  };

  const VSREF_PT: Record<string, string> = {
    ABAIXO_DO_VALOR: "Abaixo do valor",
    ACIMA_DO_VALOR:  "Acima do valor",
    NAO_SE_APLICA:   "Não se aplica",
  };

  const PRIOR_PT: Record<string, string> = {
    CRITICA: "Crítica", ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa",
  };

  // ── Aba 1: Itens ──────────────────────────────────────────────────────────
  const rowsItens = itens.map((it) => {
    const ctr = it.contratacao;
    const refTotal = it.valorReferenciaFns && it.faseUnicaQtd
      ? Number(it.valorReferenciaFns) * it.faseUnicaQtd : null;
    const ctrVal = ctr?.valorContratado ? Number(ctr.valorContratado) : null;
    const saving = refTotal && ctrVal ? refTotal - ctrVal : null;

    return {
      "Nº": it.numero,
      "Equipamento": it.equipamento,
      "Setor": it.setor?.nome ?? "",
      "Fase": it.faseCompra?.nome ?? "",
      "Status": STATUS_PT[it.statusProcesso] ?? it.statusProcesso,
      "Prioridade": it.prioridade ? (PRIOR_PT[it.prioridade] ?? it.prioridade) : "",
      "Pausado": it.pausado ? "Sim" : "Não",
      "Aprovado": it.aprovado ? "Sim" : "Não",
      "SIAFÍSICO": it.numeroSiafisico ?? "",
      "Qtd": it.faseUnicaQtd ?? 0,
      "Ref FNS (unit)": it.valorReferenciaFns ? Number(it.valorReferenciaFns) : "",
      "Ref FNS (total)": refTotal ?? "",
      "Menor orçamento (unit)": it.menorValorUnitario ? Number(it.menorValorUnitario) : "",
      "Vs referência FNS": it.statusVsReferenciaFns ? (VSREF_PT[it.statusVsReferenciaFns] ?? "") : "",
      "Fornecedor contratado": ctr?.fornecedor?.nome ?? "",
      "Nº contrato": ctr?.numeroContrato ?? "",
      "Valor contratado": ctrVal ?? "",
      "Saving (R$)": saving ?? "",
      "Saving (%)": refTotal && saving ? ((saving / refTotal) * 100).toFixed(2) + "%" : "",
      "Prazo entrega (dias)": ctr?.prazoEntregaDias ?? "",
      "Multa diária (%)": ctr?.multaDiariaPct ? (Number(ctr.multaDiariaPct) * 100).toFixed(4) + "%" : "",
      "Presente em ATA": it.presencaEmAta ? "Sim" : "Não",
      "Nº série": it.numeroSerie ?? "",
      "Patrimônio": it.patrimonioHospital ?? "",
      "Localização física": it.localizacaoFisica ?? "",
    };
  });

  // ── Aba 2: Orçamentos ─────────────────────────────────────────────────────
  const rowsOrc = itens.flatMap((it) =>
    it.orcamentos.map((o) => ({
      "Nº Item": it.numero,
      "Equipamento": it.equipamento,
      "Orç #": o.numero,
      "Fornecedor": o.fornecedor.nome,
      "Valor unitário": Number(o.valor),
      "Valor total": Number(o.valor) * (it.faseUnicaQtd ?? 0),
      "Data orçamento": o.dataOrcamento
        ? new Date(o.dataOrcamento).toLocaleDateString("pt-BR")
        : "",
      "Validade": o.validadeAte
        ? new Date(o.validadeAte).toLocaleDateString("pt-BR")
        : "",
      "Vencedor": o.vencedor ? "Sim" : "Não",
    }))
  );

  // ── Aba 3: Resumo por fornecedor ──────────────────────────────────────────
  const fornMap = new Map<string, { itens: number; valor: number; refTotal: number }>();
  for (const it of itens) {
    if (!it.contratacao) continue;
    const nome = it.contratacao.fornecedor.nome;
    const val  = Number(it.contratacao.valorContratado ?? 0);
    const ref  = it.valorReferenciaFns && it.faseUnicaQtd
      ? Number(it.valorReferenciaFns) * it.faseUnicaQtd : 0;
    const cur = fornMap.get(nome) ?? { itens: 0, valor: 0, refTotal: 0 };
    fornMap.set(nome, { itens: cur.itens + 1, valor: cur.valor + val, refTotal: cur.refTotal + ref });
  }
  const rowsForn = Array.from(fornMap.entries())
    .sort((a, b) => b[1].valor - a[1].valor)
    .map(([nome, d]) => ({
      "Fornecedor": nome,
      "Itens": d.itens,
      "Valor contratado": d.valor,
      "Ref FNS total": d.refTotal,
      "Saving (R$)": d.refTotal - d.valor,
      "Saving (%)": d.refTotal > 0
        ? (((d.refTotal - d.valor) / d.refTotal) * 100).toFixed(2) + "%"
        : "",
    }));

  // ── Montar workbook ───────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();

  const wsItens = XLSX.utils.json_to_sheet(rowsItens);
  styleHeader(wsItens, Object.keys(rowsItens[0] ?? {}));
  XLSX.utils.book_append_sheet(wb, wsItens, "Itens");

  if (rowsOrc.length > 0) {
    const wsOrc = XLSX.utils.json_to_sheet(rowsOrc);
    styleHeader(wsOrc, Object.keys(rowsOrc[0]));
    XLSX.utils.book_append_sheet(wb, wsOrc, "Orçamentos");
  }

  if (rowsForn.length > 0) {
    const wsForn = XLSX.utils.json_to_sheet(rowsForn);
    styleHeader(wsForn, Object.keys(rowsForn[0]));
    XLSX.utils.book_append_sheet(wb, wsForn, "Por Fornecedor");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="3colinas-relatorio-${date}.xlsx"`,
    },
  });
}

function styleHeader(ws: XLSX.WorkSheet, headers: string[]) {
  const cols = headers.map((h) => ({ wch: Math.max(h.length + 4, 14) }));
  ws["!cols"] = cols;
}
