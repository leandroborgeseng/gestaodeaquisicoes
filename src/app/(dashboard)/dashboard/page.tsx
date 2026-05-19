import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Topbar } from "@/components/Topbar";
import { StatusPill } from "@/components/StatusPill";
import { fmtBRL, fmtNum } from "@/lib/utils";
import { Icons } from "@/components/Icons";
import { DashboardCharts } from "./DashboardCharts";
import { StatusChart } from "@/components/charts/StatusChart";
import { FinanceChart } from "@/components/charts/FinanceChart";

export const dynamic = "force-dynamic";

// ─── Finance chart data ───────────────────────────────────────────────────────

async function getFinanceChartData(): Promise<{ mes: string; valor: number }[]> {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const rows = await prisma.contratacao.findMany({
    where: {
      dataAssinatura: { gte: from },
      valorContratado: { not: null },
    },
    select: { dataAssinatura: true, valorContratado: true },
  });

  const map = new Map<string, number>();
  for (const r of rows) {
    if (!r.dataAssinatura) continue;
    const d = new Date(r.dataAssinatura);
    const key = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(". de ", "/").replace(".", "/");
    const prev = map.get(key) ?? 0;
    map.set(key, prev + Number(r.valorContratado ?? 0));
  }

  // Build ordered 12-month series
  const result: { mes: string; valor: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mes = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(". de ", "/").replace(".", "/")
      // Capitalize first letter
      .replace(/^./, (c) => c.toUpperCase());
    result.push({ mes, valor: 0 });
  }

  // Fill values
  for (const r of rows) {
    if (!r.dataAssinatura) continue;
    const d = new Date(r.dataAssinatura);
    const mesKey = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" })
      .replace(". de ", "/").replace(".", "/")
      .replace(/^./, (c) => c.toUpperCase());
    const entry = result.find((e) => e.mes === mesKey);
    if (entry) entry.valor += Number(r.valorContratado ?? 0);
  }

  return result;
}

async function getDashboardData() {
  const now = new Date();
  const [totalItems, byStatus, recentLogs, totalValueAgg, contratacoes, acimaValor, atrasados, aguardandoAprovacao, propostasVencidas, porCategoria] = await Promise.all([
    prisma.item.count(),
    prisma.item.groupBy({ by: ["statusProcesso"], _count: { id: true } }),
    prisma.log.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { item: { select: { numero: true, equipamento: true } }, autor: { select: { name: true } } },
    }),
    prisma.item.aggregate({ _sum: { faseUnicaValorTotal: true } }),
    // Real contracted values with FNS reference for saving calculation
    prisma.contratacao.findMany({
      select: {
        valorContratado: true,
        item: { select: { valorReferenciaFns: true, faseUnicaQtd: true } },
      },
      where: { valorContratado: { not: null } },
    }),
    prisma.item.count({ where: { statusVsReferenciaFns: "ACIMA_DO_VALOR" } }),
    prisma.entrega.count({ where: { dataPrevisao: { lt: now }, dataEntrega: null } }),
    prisma.item.count({ where: { aprovado: false, statusProcesso: { notIn: ["CANCELADO", "CONCLUIDO"] } } }),
    prisma.orcamento.count({ where: { validadeAte: { lt: now }, vencedor: false } }),
    prisma.item.groupBy({ by: ["categoria"], _count: { id: true } }),
  ]);

  const contratadosTotal = byStatus
    .filter((s) => ["CONTRATADO", "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO"].includes(s.statusProcesso))
    .reduce((a, b) => a + b._count.id, 0);

  // Saving = soma(valorRefFns × qtd) - soma(valorContratado) para itens com contrato
  let somaRefContratados = 0;
  let somaContratado = 0;
  for (const c of contratacoes) {
    const ref = c.item.valorReferenciaFns ? Number(c.item.valorReferenciaFns) * (c.item.faseUnicaQtd ?? 1) : 0;
    const ctr = Number(c.valorContratado ?? 0);
    if (ref > 0) somaRefContratados += ref;
    somaContratado += ctr;
  }
  const savingTotal = somaRefContratados > 0 ? somaRefContratados - somaContratado : null;
  const savingPct   = somaRefContratados > 0 ? (savingTotal! / somaRefContratados) * 100 : null;

  const catCount = {
    MEDICO_HOSPITALAR: porCategoria.find(c => c.categoria === "MEDICO_HOSPITALAR")?._count.id ?? 0,
    TI:               porCategoria.find(c => c.categoria === "TI")?._count.id               ?? 0,
    MOBILIARIO:       porCategoria.find(c => c.categoria === "MOBILIARIO")?._count.id        ?? 0,
  };

  return {
    totalItems,
    byStatus,
    totalValue: Number(totalValueAgg._sum.faseUnicaValorTotal ?? 0),
    contratadosTotal,
    somaContratado,
    savingTotal,
    savingPct,
    acimaValor,
    atrasados,
    aguardandoAprovacao,
    propostasVencidas,
    recentLogs,
    catCount,
  };
}

const ACTIVITY_COLORS: Record<string, string> = {
  STATUS_ALTERADO: "var(--accent)",
  NF_REGISTRADA: "oklch(0.58 0.11 130)",
  ENTREGA_REGISTRADA: "oklch(0.58 0.12 95)",
  TESTE_REGISTRADO: "var(--ok)",
  CONTRATO_REGISTRADO: "oklch(0.50 0.10 240)",
  COTACAO_REGISTRADA: "oklch(0.62 0.08 250)",
};

const STATUS_ORDER = [
  "PENDENTE", "COTACAO_EM_ANDAMENTO", "COTACAO_CONCLUIDA", "CONTRATADO",
  "ENTREGA_PARCIAL", "ENTREGUE", "NF_RECEBIDA", "EM_TESTE", "CONCLUIDO", "CANCELADO",
];

const STATUS_LABELS_SHORT: Record<string, string> = {
  PENDENTE: "Pendente",
  COTACAO_EM_ANDAMENTO: "Cotação inic.",
  COTACAO_CONCLUIDA: "Cotação concl.",
  CONTRATADO: "Contratado",
  ENTREGA_PARCIAL: "Entrega parcial",
  ENTREGUE: "Entregue",
  NF_RECEBIDA: "NF recebida",
  EM_TESTE: "Em teste",
  CONCLUIDO: "Concluído",
  CANCELADO: "Cancelado",
};

async function getFornecedorData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { fornecedor: true },
  });
  if (!user?.fornecedor) return null;
  const fId = user.fornecedor.id;
  const [contratacoes, orcamentos] = await Promise.all([
    prisma.contratacao.findMany({
      where: { fornecedorId: fId },
      include: { item: { select: { numero: true, equipamento: true, statusProcesso: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.orcamento.findMany({
      where: { fornecedorId: fId },
      include: { item: { select: { numero: true, equipamento: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return { fornecedor: user.fornecedor, contratacoes, orcamentos };
}

export default async function DashboardPage() {
  const session = await auth();
  const role = (session?.user as { role?: string })?.role;

  if (role === "FORNECEDOR") {
    const fd = await getFornecedorData(session!.user!.id!);
    if (!fd) return <div className="content"><div className="content-inner" style={{ padding: 32 }}>Nenhum fornecedor vinculado a este usuário.</div></div>;
    const totalContratado = fd.contratacoes.reduce((s, c) => s + Number(c.valorContratado ?? 0), 0);
    return (
      <>
        <Topbar crumbs={["3Colinas", "Meu Painel"]} />
        <div className="content">
          <div className="content-inner">
            <div className="page-head">
              <div>
                <h1>{fd.fornecedor.nome}</h1>
                <p>Painel do fornecedor · {fd.contratacoes.length} contratos · {fd.orcamentos.length} propostas</p>
              </div>
            </div>
            <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 18 }}>
              <div className="kpi"><div className="label">Contratos ativos</div><div className="value">{fd.contratacoes.filter(c => !["CANCELADO","CONCLUIDO"].includes(c.item.statusProcesso)).length}</div></div>
              <div className="kpi"><div className="label">Valor total contratado</div><div className="value" style={{ fontSize: 18 }}>{fmtBRL(totalContratado)}</div></div>
              <div className="kpi"><div className="label">Propostas enviadas</div><div className="value">{fd.orcamentos.length}</div></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="card">
                <div className="card-head"><h3>Meus contratos</h3></div>
                {fd.contratacoes.length === 0 ? (
                  <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--fg-faint)" }}>Nenhum contrato ainda.</div>
                ) : fd.contratacoes.map((c, i) => (
                  <div key={c.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < fd.contratacoes.length - 1 ? "1px solid var(--line-soft)" : "none", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{c.item.equipamento}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 1 }}>{c.item.numero}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <StatusPill status={c.item.statusProcesso} />
                      {c.valorContratado && <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 3 }}>{fmtBRL(Number(c.valorContratado))}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="card">
                <div className="card-head"><h3>Minhas propostas</h3></div>
                {fd.orcamentos.length === 0 ? (
                  <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--fg-faint)" }}>Nenhuma proposta ainda.</div>
                ) : fd.orcamentos.map((o, i) => (
                  <div key={o.id} style={{ display: "flex", gap: 10, padding: "10px 14px", borderBottom: i < fd.orcamentos.length - 1 ? "1px solid var(--line-soft)" : "none", alignItems: "center" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{o.item.equipamento}</div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 1 }}>{o.item.numero}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {o.vencedor && <span className="pill-soft ok" style={{ fontSize: 10.5 }}>Vencedor</span>}
                      {o.valor && <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 3 }}>{fmtBRL(Number(o.valor))}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  const [data, financeData] = await Promise.all([getDashboardData(), getFinanceChartData()]);

  const dist = STATUS_ORDER.map((s) => ({
    status: s,
    label: STATUS_LABELS_SHORT[s] ?? s,
    qtd: data.byStatus.find((b) => b.statusProcesso === s)?._count?.id ?? 0,
  })).filter((d) => d.qtd > 0);

  const statusChartData = STATUS_ORDER
    .map((s) => ({ status: s, count: data.byStatus.find((b) => b.statusProcesso === s)?._count?.id ?? 0 }))
    .filter((d) => d.count > 0);

  const alertas = [
    ...(data.atrasados > 0 ? [{ titulo: "Entregas atrasadas", motivo: `${data.atrasados} entregas com prazo vencido`, severidade: "alta" as const }] : []),
    ...(data.acimaValor > 0 ? [{ titulo: "Itens acima do valor FNS", motivo: `${data.acimaValor} itens sem justificativa`, severidade: "alta" as const }] : []),
    ...(data.aguardandoAprovacao > 0 ? [{ titulo: "Itens aguardando aprovação", motivo: `${data.aguardandoAprovacao} ${data.aguardandoAprovacao === 1 ? "item aguarda" : "itens aguardam"} aprovação do administrador`, severidade: "media" as const }] : []),
    ...(data.propostasVencidas > 0 ? [{ titulo: "Propostas com validade expirada", motivo: `${data.propostasVencidas} orçamentos com proposta vencida`, severidade: "media" as const }] : []),
  ];

  return (
    <>
      <Topbar crumbs={["3Colinas", "Dashboard"]}>
        <button className="btn ghost sm">
          <Icons.Download style={{ width: 12, height: 12 }} /> Exportar
        </button>
        <button className="btn sm">
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "var(--ok)" }} />
          Abr–Mai 2026
          <Icons.ChevDown style={{ width: 12, height: 12 }} />
        </button>
      </Topbar>

      <div className="content">
        <div className="content-inner">
          <div className="page-head">
            <div>
              <h1>Visão geral da Fase Única</h1>
              <p>
                {fmtNum(data.totalItems)} itens em gestão · valor de referência FNS {fmtBRL(data.totalValue)} · entrega prevista até{" "}
                <span className="mono">25/jul/2026</span>
              </p>
            </div>
            <div className="actions">
              <button className="btn primary">
                <Icons.Spark style={{ width: 12, height: 12 }} /> Nova rodada de cotação
              </button>
            </div>
          </div>

          {/* Category KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
            {([
              { v: "MEDICO_HOSPITALAR", l: "Equipamentos Médicos", icon: "🏥", color: "var(--accent)",         bg: "var(--accent-soft)" },
              { v: "TI",               l: "Tecnologia da Informação", icon: "💻", color: "oklch(0.62 0.12 250)", bg: "oklch(0.95 0.04 250)" },
              { v: "MOBILIARIO",       l: "Mobiliário",            icon: "🪑", color: "oklch(0.60 0.10 85)",   bg: "oklch(0.95 0.03 85)"  },
            ] as const).map((cat) => (
              <a
                key={cat.v}
                href={`/itens?categoria=${cat.v}`}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 14px", borderRadius: 8, textDecoration: "none",
                  background: cat.bg, border: `1px solid ${cat.color}33`,
                  transition: "opacity 0.1s",
                }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{cat.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: cat.color, lineHeight: 1 }}>
                    {fmtNum(data.catCount[cat.v as keyof typeof data.catCount])}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--fg-dim)", marginTop: 2, whiteSpace: "nowrap" }}>{cat.l}</div>
                </div>
              </a>
            ))}
          </div>

          {/* KPI Row */}
          <div className="kpi-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            <div className="kpi">
              <div className="label">
                Itens contratados{" "}
                <span className="pill-soft">{Math.round((data.contratadosTotal / data.totalItems) * 100)}%</span>
              </div>
              <div className="value">
                {fmtNum(data.contratadosTotal)} <small>/ {fmtNum(data.totalItems)}</small>
              </div>
              <div className="meta">
                <span>Fases iniciadas ou concluídas</span>
              </div>
            </div>
            <div className="kpi">
              <div className="label">Valor contratado</div>
              <div className="value">
                {data.somaContratado > 0
                  ? fmtBRL(data.somaContratado)
                  : <span style={{ fontSize: 16, color: "var(--fg-faint)" }}>Sem contratos</span>}
              </div>
              <div className="meta">
                {data.savingPct != null
                  ? <><span className="delta-pos">{data.savingPct >= 0 ? "−" : "+"}{Math.abs(data.savingPct).toFixed(1)}%</span><span className="muted"> vs referência FNS</span></>
                  : <span className="muted">Aguardando contratos</span>}
              </div>
            </div>
            <div className="kpi">
              <div className="label">Saving acumulado</div>
              <div className="value" style={{ color: data.savingTotal != null && data.savingTotal >= 0 ? "var(--ok)" : "var(--danger)" }}>
                {data.savingTotal != null
                  ? fmtBRL(Math.abs(data.savingTotal))
                  : <span style={{ fontSize: 16, color: "var(--fg-faint)" }}>—</span>}
              </div>
              <div className="meta">
                <span className="muted">
                  {data.savingTotal != null
                    ? (data.savingTotal >= 0 ? "Economia vs referência FNS" : "Acima da referência FNS")
                    : "Preencha contratos para calcular"}
                </span>
              </div>
            </div>
            <div className="kpi" style={{ borderColor: alertas.length > 0 ? "oklch(0.86 0.08 25)" : undefined }}>
              <div className="label">
                <span style={{
                  display: "inline-flex", width: 14, height: 14, borderRadius: 3,
                  background: "var(--danger-soft)", color: "var(--danger)",
                  placeItems: "center",
                }}>
                  <Icons.Alert style={{ width: 9, height: 9 }} />
                </span>
                Atenção necessária
              </div>
              <div className="value">{alertas.length}</div>
              <div className="meta">
                {data.aguardandoAprovacao > 0 && <span className="warn-text">{data.aguardandoAprovacao} aguard. aprovação · </span>}
                <span className="danger-text">{data.atrasados} atrasadas</span>
                {data.propostasVencidas > 0 && <span className="muted"> · {data.propostasVencidas} propostas vencidas</span>}
              </div>
            </div>
          </div>

          {/* Row 2: distribution + schedule */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,360px) 1fr", gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head">
                <h3>Distribuição por status</h3>
                <div className="spacer" />
                <span className="pill-soft">{data.totalItems} itens</span>
              </div>
              <div className="card-body">
                <DashboardCharts dist={dist} />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Cronograma de entregas</h3>
                <span className="sub">próximas 8 semanas</span>
                <div className="spacer" />
                <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fg-dim)" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent)" }} />Previstas
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 9, height: 9, borderRadius: 2, background: "var(--accent-soft)", border: "1px dashed var(--accent-line)" }} />Concluídas
                  </span>
                </div>
              </div>
              <div className="card-body" style={{ paddingTop: 18 }}>
                <CronogramaStatic />
              </div>
            </div>
          </div>

          {/* Row 3: activity + alerts */}
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,360px)", gap: 12, marginBottom: 18 }}>
            <div className="card">
              <div className="card-head">
                <h3>Atividade recente</h3>
                <div className="spacer" />
                <button className="btn ghost sm">
                  Ver tudo <Icons.Chevron style={{ width: 12, height: 12 }} />
                </button>
              </div>
              <div>
                {data.recentLogs.length === 0 ? (
                  <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhuma atividade ainda.</div>
                ) : data.recentLogs.map((log, i) => (
                  <div key={log.id} style={{
                    display: "flex", gap: 10, padding: "10px 14px",
                    borderBottom: i < data.recentLogs.length - 1 ? "1px solid var(--line-soft)" : "0",
                    alignItems: "flex-start",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: "50%",
                      background: "var(--bg-soft)", color: ACTIVITY_COLORS[log.acao] ?? "var(--fg-dim)",
                      display: "grid", placeItems: "center", flexShrink: 0,
                    }}>
                      <Icons.Spark style={{ width: 12, height: 12 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.4 }}>
                        <span style={{ fontWeight: 500 }}>{log.autor.name}</span>
                        <span className="muted"> em </span>
                        <span className="mono" style={{ fontSize: 11.5 }}>{log.item.numero}</span>
                        <span className="muted"> — </span>
                        <span>{log.acao.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--fg-faint)", marginTop: 2 }}>
                        {new Date(log.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Alertas</h3>
                <div className="spacer" />
                {alertas.length > 0
                  ? <span className="pill-soft warn">{alertas.length} ativos</span>
                  : <span className="pill-soft ok">Tudo ok</span>}
              </div>
              <div style={{ padding: "4px 0" }}>
                {alertas.length === 0 ? (
                  <div style={{ padding: "20px 14px", color: "var(--fg-faint)", fontSize: 12.5 }}>Nenhum alerta ativo.</div>
                ) : alertas.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", gap: 10, padding: "10px 14px",
                    borderBottom: i < alertas.length - 1 ? "1px solid var(--line-soft)" : "0",
                  }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: 5, flexShrink: 0,
                      background: "var(--danger-soft)", color: "var(--danger)",
                      display: "grid", placeItems: "center",
                    }}>
                      <Icons.Alert style={{ width: 13, height: 13 }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, marginBottom: 2 }}>{a.titulo}</div>
                      <div style={{ fontSize: 11.5, color: "var(--fg-dim)", lineHeight: 1.4 }}>{a.motivo}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Row 4: recharts — status distribution + finance evolution */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="card">
              <div className="card-head">
                <h3>Distribuição por status</h3>
              </div>
              <div style={{ padding: 14 }}>
                <StatusChart data={statusChartData} />
              </div>
            </div>

            <div className="card">
              <div className="card-head">
                <h3>Evolução financeira — últimos 12 meses</h3>
              </div>
              <div style={{ padding: 14 }}>
                <FinanceChart data={financeData} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CronogramaStatic() {
  const semanas = ["Sem 18", "Sem 19", "Sem 20", "Sem 21", "Sem 22", "Sem 23", "Sem 24", "Sem 25"];
  const data = [
    { qtd: 8, conc: 8 }, { qtd: 14, conc: 12 }, { qtd: 22, conc: 19 }, { qtd: 18, conc: 11 },
    { qtd: 28, conc: 14 }, { qtd: 31, conc: 0 }, { qtd: 24, conc: 0 }, { qtd: 17, conc: 0 },
  ];
  const max = Math.max(...data.map((d) => d.qtd));
  const h = 110;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: h, paddingBottom: 4, borderBottom: "1px solid var(--line)" }}>
        {data.map((d, i) => {
          const bh = (d.qtd / max) * (h - 22);
          const bhConc = (d.conc / max) * (h - 22);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end", position: "relative" }}>
              <span style={{ position: "absolute", bottom: bh + 4, fontSize: 10, color: "var(--fg-dim)", fontVariantNumeric: "tabular-nums" }}>{d.qtd}</span>
              <div style={{
                width: "100%", maxWidth: 38, height: bh, borderRadius: "4px 4px 0 0",
                background: i >= 5 ? "var(--accent-soft)" : "var(--accent)",
                border: i >= 5 ? "1px dashed var(--accent-line)" : "none",
                position: "relative",
              }}>
                {d.conc > 0 && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: bhConc, background: "var(--accent)", opacity: 0.45 }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        {semanas.map((w, i) => (
          <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10.5, color: i >= 5 ? "var(--fg-faint)" : "var(--fg-dim)", fontFamily: "var(--font-mono)" }}>{w}</div>
        ))}
      </div>
    </div>
  );
}
