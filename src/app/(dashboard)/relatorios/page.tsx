import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtBRL, fmtNum } from "@/lib/utils";
import { RelatoriosCharts } from "./RelatoriosCharts";

export const dynamic = "force-dynamic";

async function getRelatoriosData() {
  const [totalItems, byStatus, contratacoes, fornecedores, vsRefCounts] = await Promise.all([
    prisma.item.count(),
    prisma.item.groupBy({ by: ["statusProcesso"], _count: { id: true } }),
    prisma.contratacao.findMany({
      include: {
        fornecedor: { select: { nome: true } },
        item: { select: { faseUnicaQtd: true, faseUnicaValorTotal: true, valorReferenciaFns: true } },
      },
    }),
    prisma.fornecedor.findMany({
      include: {
        contratacoes: {
          include: { item: { select: { faseUnicaValorTotal: true, valorReferenciaFns: true, faseUnicaQtd: true } } },
        },
        _count: { select: { contratacoes: true } },
      },
    }),
    prisma.item.groupBy({ by: ["statusVsReferenciaFns"], _count: { id: true } }),
  ]);

  const totalContratado = contratacoes.reduce((a, c) => a + Number(c.valorContratado ?? 0), 0);
  const totalRef = await prisma.item.aggregate({ _sum: { faseUnicaValorTotal: true } });
  const totalRefVal = Number(totalRef._sum.faseUnicaValorTotal ?? 0);
  const economia = totalRefVal - totalContratado;

  const fornecedoresData = fornecedores
    .filter((f) => f._count.contratacoes > 0)
    .map((f) => {
      const valor = f.contratacoes.reduce((a, c) => a + Number(c.valorContratado ?? 0), 0);
      const refTotal = f.contratacoes.reduce(
        (a, c) => a + Number(c.item.valorReferenciaFns ?? 0) * (c.item.faseUnicaQtd ?? 0),
        0
      );
      const eco = refTotal - valor;
      return { nome: f.nome, itens: f._count.contratacoes, valor, economia: eco, pct: refTotal > 0 ? eco / refTotal : 0 };
    })
    .sort((a, b) => b.valor - a.valor);

  const count = (statuses: string[]) =>
    byStatus.filter((s) => statuses.includes(s.statusProcesso)).reduce((a, b) => a + b._count.id, 0);

  const funilData = [
    { lab: "Total de itens", n: totalItems },
    { lab: "Cotação iniciada", n: count(["COTACAO_EM_ANDAMENTO", "COTACAO_CONCLUIDA", "CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]) },
    { lab: "Cotação concluída", n: count(["COTACAO_CONCLUIDA", "CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]) },
    { lab: "Contratado", n: count(["CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]) },
    { lab: "Entregue (total/parcial)", n: count(["ENTREGUE", "ENTREGA_PARCIAL", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]) },
    { lab: "NF recebida", n: count(["NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]) },
    { lab: "Concluído", n: count(["CONCLUIDO"]) },
  ];

  const vsRef = {
    abaixo: vsRefCounts.find((v) => v.statusVsReferenciaFns === "ABAIXO_DO_VALOR")?._count.id ?? 0,
    acima: vsRefCounts.find((v) => v.statusVsReferenciaFns === "ACIMA_DO_VALOR")?._count.id ?? 0,
    nsa: vsRefCounts.find((v) => v.statusVsReferenciaFns === "NAO_SE_APLICA")?._count.id ?? 0,
  };

  const contratadosQtd = count(["CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]);
  const concluidos = count(["CONCLUIDO"]);
  const entregues = count(["ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"]);

  const entregaTotal = await prisma.entrega.aggregate({ _sum: { qtdEntregue: true } });
  const nfTotal = await prisma.notaFiscal.aggregate({ _sum: { valor: true } });

  const byStatusChart = ["PENDENTE","COTACAO_EM_ANDAMENTO","COTACAO_CONCLUIDA","CONTRATADO","ENTREGA_PARCIAL","ENTREGUE","NF_RECEBIDA","EM_TESTE","CONCLUIDO","CANCELADO"]
    .map((s) => ({ status: s, n: count([s]) }))
    .filter((s) => s.n > 0);

  return {
    totalItems, totalRef: totalRefVal, totalContratado, economia,
    contratadosQtd, concluidos, entregues,
    fornecedoresData, funilData, vsRef, byStatusChart,
    totalEntregue: Number(entregaTotal._sum.qtdEntregue ?? 0),
    totalNF: Number(nfTotal._sum.valor ?? 0),
  };
}

export default async function RelatoriosPage() {
  const data = await getRelatoriosData();
  const economiaPct = data.totalRef > 0 ? ((data.economia / data.totalRef) * 100).toFixed(1) : "0.0";
  const contratadosPct = data.totalItems > 0 ? Math.round((data.contratadosQtd / data.totalItems) * 100) : 0;

  return (
    <>
      <Topbar crumbs={["3Colinas", "Relatórios"]}>
        <a href="/api/relatorios/excel" className="btn">
          <Icons.Download style={{ width: 12, height: 12 }} /> Excel
        </a>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Relatórios</h1>
              <p>Análise financeira, cronograma, desempenho por fornecedor e indicadores vs referência FNS.</p>
            </div>
          </div>

          {/* KPI Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            <div className="kpi">
              <div className="label">Valor de referência FNS</div>
              <div className="value">{fmtBRL(data.totalRef)}</div>
              <div className="meta">{data.totalItems} itens · base FNS/RENEM 2026</div>
            </div>
            <div className="kpi" style={{ borderColor: "var(--accent-line)", background: "var(--accent-soft)" }}>
              <div className="label">Total contratado</div>
              <div className="value">{fmtBRL(data.totalContratado)}</div>
              <div className="meta">
                {contratadosPct}% da fase ·{" "}
                <span className={data.economia >= 0 ? "ok-text" : "danger-text"}>
                  {data.economia >= 0 ? "economia" : "acréscimo"} {fmtBRL(Math.abs(data.economia))}
                </span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Itens entregues</div>
              <div className="value">{fmtNum(data.entregues)}</div>
              <div className="meta">{data.totalEntregue} unidades recebidas no total</div>
            </div>
            <div className="kpi">
              <div className="label">Total liquidado (NF)</div>
              <div className="value">{fmtBRL(data.totalNF)}</div>
              <div className="meta">{data.fornecedoresData.length} fornecedores com contrato</div>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head">
                <h3>Distribuição por status</h3>
                <div className="spacer" />
                <span className="sub">{data.totalItems} itens</span>
              </div>
              <div className="card-body">
                <RelatoriosCharts byStatus={data.byStatusChart} totalItems={data.totalItems} />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Comparativo vs referência FNS</h3>
                <div className="spacer" />
                <span className="pill-soft ok">{data.vsRef.abaixo} abaixo</span>
                <span className="pill-soft warn" style={{ marginLeft: 4 }}>{data.vsRef.acima} acima</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 12.5, color: "var(--fg-dim)", marginBottom: 12 }}>
                  De {data.totalItems} itens analisados:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: "Abaixo do valor FNS", qtd: data.vsRef.abaixo, color: "var(--ok)" },
                    { label: "Acima do valor FNS", qtd: data.vsRef.acima, color: "var(--danger)" },
                    { label: "Não se aplica", qtd: data.vsRef.nsa, color: "var(--line-strong)" },
                  ].map((r) => {
                    const pct = data.totalItems > 0 ? (r.qtd / data.totalItems) * 100 : 0;
                    return (
                      <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                        <div style={{ width: 140, color: "var(--fg-mid)" }}>{r.label}</div>
                        <div style={{ flex: 1, height: 18, background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: pct + "%", background: r.color, opacity: 0.7 }} />
                        </div>
                        <span className="mono" style={{ width: 36, textAlign: "right", fontSize: 11 }}>{r.qtd}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                    <span style={{ color: "var(--fg-dim)" }}>Economia acumulada</span>
                    <span className={data.economia >= 0 ? "ok-text" : "danger-text"} style={{ fontWeight: 600 }}>
                      {economiaPct}% · {fmtBRL(data.economia)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Funil */}
          <div className="card" style={{ marginBottom: 18 }}>
            <div className="card-head">
              <h3>Funil de execução</h3>
              <span className="sub">progresso real do fluxo de aquisição</span>
            </div>
            <div className="card-body">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {data.funilData.map((e, i) => {
                  const pct = data.funilData[0].n > 0 ? (e.n / data.funilData[0].n) * 100 : 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                      <div style={{ width: 160, color: "var(--fg-mid)" }}>{e.lab}</div>
                      <div style={{ flex: 1, height: 20, background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
                        <div style={{
                          height: "100%", width: pct + "%",
                          background: `oklch(${0.48 + i * 0.03} 0.10 175)`,
                        }} />
                        <span style={{
                          position: "absolute", top: 0, left: 8, height: "100%",
                          display: "flex", alignItems: "center",
                          fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)",
                          color: pct > 20 ? "var(--accent-fg)" : "var(--fg)",
                        }}>{fmtNum(e.n)}</span>
                      </div>
                      <div className="mono" style={{ width: 48, textAlign: "right", fontSize: 10.5, color: "var(--fg-dim)" }}>
                        {pct.toFixed(0)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Supplier table */}
          <div className="card">
            <div className="card-head">
              <h3>Desempenho por fornecedor</h3>
              <div className="spacer" />
              <span className="sub">{data.fornecedoresData.length} fornecedores com contrato</span>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th style={{ textAlign: "right" }}>Itens</th>
                  <th style={{ textAlign: "right" }}>Valor contratado</th>
                  <th style={{ textAlign: "right" }}>vs FNS</th>
                  <th style={{ textAlign: "right" }}>Economia</th>
                </tr>
              </thead>
              <tbody>
                {data.fornecedoresData.slice(0, 20).map((f) => (
                  <tr key={f.nome}>
                    <td className="strong">{f.nome}</td>
                    <td className="num" style={{ textAlign: "right" }}>{f.itens}</td>
                    <td className="num strong" style={{ textAlign: "right" }}>{fmtBRL(f.valor)}</td>
                    <td style={{ textAlign: "right" }}>
                      <span className={`pill-soft ${f.economia > 0 ? "ok" : "warn"}`} style={{ fontSize: 10.5 }}>
                        {f.economia > 0 ? "−" : "+"}{(Math.abs(f.pct) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className={`num ${f.economia >= 0 ? "ok-text" : "danger-text"}`} style={{ textAlign: "right", fontWeight: 500 }}>
                      {fmtBRL(f.economia)}
                    </td>
                  </tr>
                ))}
                {data.fornecedoresData.length === 0 && (
                  <tr><td colSpan={5} style={{ padding: "20px 12px", color: "var(--fg-faint)", fontSize: 12.5 }}>
                    Nenhum contrato registrado ainda.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
