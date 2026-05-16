import { prisma } from "@/lib/prisma";
import { Topbar } from "@/components/Topbar";
import { Icons } from "@/components/Icons";
import { fmtBRL, fmtNum } from "@/lib/utils";
import { RelatoriosCharts } from "./RelatoriosCharts";

export const dynamic = "force-dynamic";

async function getRelatoriosData() {
  const [totalItems, byStatus, contratacoes, fornecedores] = await Promise.all([
    prisma.item.count(),
    prisma.item.groupBy({ by: ["statusProcesso"], _count: { id: true } }),
    prisma.contratacao.findMany({
      include: { fornecedor: { select: { nome: true } }, item: { select: { faseUnicaQtd: true, faseUnicaValorTotal: true } } },
    }),
    prisma.fornecedor.findMany({
      include: {
        contratacoes: { include: { item: { select: { faseUnicaValorTotal: true, valorReferenciaFns: true, faseUnicaQtd: true } } } },
        _count: { select: { contratacoes: true } },
      },
    }),
  ]);

  const totalContratado = contratacoes.reduce((a, c) => a + Number(c.valorContratado ?? 0), 0);
  const totalRef = await prisma.item.aggregate({ _sum: { faseUnicaValorTotal: true } });

  const fornecedoresData = fornecedores
    .filter((f) => f._count.contratacoes > 0)
    .map((f) => {
      const valor = f.contratacoes.reduce((a, c) => a + Number(c.valorContratado ?? 0), 0);
      const refTotal = f.contratacoes.reduce((a, c) => a + Number(c.item.valorReferenciaFns ?? 0) * (c.item.faseUnicaQtd ?? 0), 0);
      const economia = refTotal - valor;
      return {
        nome: f.nome,
        itens: f._count.contratacoes,
        valor,
        economia,
        pct: refTotal > 0 ? (economia / refTotal) : 0,
      };
    })
    .sort((a, b) => b.valor - a.valor);

  const concluidos = byStatus.filter((s) => ["CONCLUIDO", "EM_TESTE", "NF_RECEBIDA", "ENTREGUE"].includes(s.statusProcesso)).reduce((a, b) => a + b._count.id, 0);

  return {
    totalItems,
    totalRef: Number(totalRef._sum.faseUnicaValorTotal ?? 0),
    totalContratado,
    concluidos,
    fornecedoresData,
    byStatus,
  };
}

const CATEGORIAS = [
  { nome: "Equipamentos médico-hospitalares", qtd: 142, valor: 18420600, pct: 73.7 },
  { nome: "Mobiliário hospitalar", qtd: 48, valor: 3820000, pct: 15.3 },
  { nome: "Equipamentos de apoio diagnóstico", qtd: 28, valor: 2148000, pct: 8.6 },
  { nome: "Esterilização e processamento", qtd: 12, valor: 432000, pct: 1.7 },
  { nome: "Outros", qtd: 7, valor: 167400, pct: 0.7 },
];

export default async function RelatoriosPage() {
  const data = await getRelatoriosData();

  return (
    <>
      <Topbar crumbs={["3Colinas", "Relatórios"]}>
        <button className="btn"><Icons.Filter style={{ width: 12, height: 12 }} /> Filtros</button>
        <button className="btn"><Icons.Download style={{ width: 12, height: 12 }} /> Excel</button>
        <button className="btn primary"><Icons.Doc style={{ width: 12, height: 12 }} /> Gerar PDF</button>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Relatórios</h1>
              <p>Análise financeira, cronograma, desempenho por fornecedor e indicadores vs referência FNS.</p>
            </div>
          </div>

          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 2, marginBottom: 18, background: "var(--bg-soft)", borderRadius: 8, padding: 3, width: "fit-content" }}>
            {["Financeiro", "Por status", "Por fornecedor", "Cronograma", "Vs referência FNS"].map((t, i) => (
              <button key={t} style={{
                padding: "6px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
                background: i === 0 ? "var(--bg-panel)" : "transparent",
                color: i === 0 ? "var(--fg)" : "var(--fg-dim)",
                boxShadow: i === 0 ? "0 1px 0 oklch(0 0 0 / 0.04), 0 1px 2px oklch(0 0 0 / 0.04)" : "none",
                border: "none", cursor: "pointer",
              }}>{t}</button>
            ))}
          </div>

          {/* Period filter */}
          <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center" }}>
            <div style={{ display: "flex", border: "1px solid var(--line)", borderRadius: 6, overflow: "hidden", background: "var(--bg-panel)" }}>
              {["Mês", "Trimestre", "Ano", "Personalizado"].map((p, i) => (
                <button key={p} style={{
                  padding: "5px 12px", fontSize: 11.5,
                  borderRight: i < 3 ? "1px solid var(--line)" : "none",
                  background: i === 2 ? "var(--bg-soft)" : "transparent",
                  fontWeight: i === 2 ? 500 : 400,
                  color: i === 2 ? "var(--fg)" : "var(--fg-dim)",
                  border: "none", cursor: "pointer",
                }}>{p}</button>
              ))}
            </div>
            <span style={{ fontSize: 12, color: "var(--fg-dim)" }}>01/jan/2026 — 15/mai/2026</span>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 11.5, color: "var(--fg-faint)" }}>Atualizado agora</span>
          </div>

          {/* KPI Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            <div className="kpi">
              <div className="label">Valor de referência FNS</div>
              <div className="value">{fmtBRL(data.totalRef).replace("R$ ", "R$ ")}</div>
              <div className="meta">{data.totalItems} itens · base FNS/RENEM 2026</div>
            </div>
            <div className="kpi" style={{ borderColor: "var(--accent-line)", background: "var(--accent-soft)" }}>
              <div className="label">Total contratado</div>
              <div className="value">R$ 18,42<small>M</small></div>
              <div className="meta">
                74% da fase ·{" "}
                <span className="ok-text">R$ 1,28M de economia</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Total entregue</div>
              <div className="value">R$ 12,84<small>M</small></div>
              <div className="meta">81 itens recebidos integralmente</div>
            </div>
            <div className="kpi">
              <div className="label">Total liquidado (NF)</div>
              <div className="value">R$ 9,76<small>M</small></div>
              <div className="meta">47 NFs registradas · 11 em conferência</div>
            </div>
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head">
                <h3>Evolução acumulada — contratado vs referência</h3>
                <div className="spacer" />
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fg-dim)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 14, height: 2, background: "var(--fg)", opacity: 0.4 }} />Referência FNS
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 14, height: 2, background: "var(--accent)" }} />Contratado
                  </span>
                </div>
              </div>
              <div className="card-body">
                <RelatoriosCharts />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Por categoria de aquisição</h3>
                <div className="spacer" />
                <span className="sub">5 grupos</span>
              </div>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {CATEGORIAS.map((c, i) => (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11.5, alignItems: "baseline" }}>
                      <span style={{ color: "var(--fg)", fontWeight: 500 }}>{c.nome}</span>
                      <span className="mono" style={{ color: "var(--fg-dim)" }}>{fmtBRL(c.valor)}</span>
                    </div>
                    <div style={{ height: 6, background: "var(--bg-soft)", borderRadius: 2, overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: c.pct + "%",
                        background: `oklch(${0.42 + i * 0.07} 0.10 ${175 - i * 15})`,
                        borderRadius: 2,
                      }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 10.5, color: "var(--fg-faint)" }}>
                      <span>{c.qtd} itens</span>
                      <span className="mono">{c.pct.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Funil */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head"><h3>Funil de execução</h3><span className="sub">tempo médio entre etapas</span></div>
              <div className="card-body">
                <FunilStatic />
              </div>
            </div>
            <div className="card">
              <div className="card-head">
                <h3>Comparativo vs referência FNS</h3>
                <div className="spacer" />
                <span className="pill-soft ok">122 abaixo</span>
                <span className="pill-soft warn" style={{ marginLeft: 4 }}>14 acima</span>
              </div>
              <div className="card-body">
                <div style={{ fontSize: 12.5, color: "var(--fg-dim)", marginBottom: 12 }}>
                  De {data.totalItems} itens analisados:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: "Abaixo do valor FNS", qtd: 122, pct: 77, color: "var(--ok)" },
                    { label: "No valor FNS", qtd: 14, pct: 9, color: "var(--fg-dim)" },
                    { label: "Acima do valor FNS", qtd: 14, pct: 9, color: "var(--danger)" },
                    { label: "Não se aplica", qtd: 8, pct: 5, color: "var(--line-strong)" },
                  ].map((r) => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
                      <div style={{ width: 130, color: "var(--fg-mid)" }}>{r.label}</div>
                      <div style={{ flex: 1, height: 18, background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: r.pct + "%", background: r.color, opacity: 0.7 }} />
                      </div>
                      <span className="mono" style={{ width: 40, textAlign: "right", fontSize: 11 }}>{r.qtd}</span>
                    </div>
                  ))}
                </div>
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
                {data.fornecedoresData.map((f) => (
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
                  <tr><td colSpan={5} style={{ padding: "20px 12px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhum dado disponível.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function FunilStatic() {
  const etapas = [
    { lab: "Cotação iniciada", n: 237, t: "—" },
    { lab: "Cotação concluída", n: 219, t: "5,8 dias" },
    { lab: "Contratado", n: 163, t: "12,2 dias" },
    { lab: "Entregue", n: 81, t: "32,4 dias" },
    { lab: "NF recebida", n: 64, t: "1,6 dias" },
    { lab: "Concluído", n: 13, t: "21,1 dias" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {etapas.map((e, i) => {
        const pct = (e.n / etapas[0].n) * 100;
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11.5 }}>
            <div style={{ width: 120, color: "var(--fg-mid)" }}>{e.lab}</div>
            <div style={{ flex: 1, height: 20, background: "var(--bg-soft)", borderRadius: 3, overflow: "hidden", position: "relative" }}>
              <div style={{
                height: "100%", width: pct + "%",
                background: `oklch(${0.50 + (i * 0.04)} 0.10 175)`,
              }} />
              <span style={{ position: "absolute", top: 0, left: 8, height: "100%", display: "flex", alignItems: "center", fontSize: 11, color: "var(--accent-fg)", fontWeight: 600, fontFamily: "var(--font-mono)" }}>{e.n}</span>
            </div>
            <div className="mono" style={{ width: 64, textAlign: "right", fontSize: 10.5, color: "var(--fg-dim)" }}>{e.t}</div>
          </div>
        );
      })}
    </div>
  );
}
