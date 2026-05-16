"use client";

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "oklch(0.72 0.04 240)",
  COTACAO_EM_ANDAMENTO: "oklch(0.68 0.08 200)",
  COTACAO_CONCLUIDA: "oklch(0.60 0.10 200)",
  CONTRATADO: "oklch(0.52 0.12 175)",
  ENTREGA_PARCIAL: "oklch(0.62 0.11 95)",
  ENTREGUE: "oklch(0.55 0.12 130)",
  NF_RECEBIDA: "oklch(0.55 0.10 150)",
  EM_TESTE: "oklch(0.52 0.10 240)",
  CONCLUIDO: "oklch(0.46 0.10 175)",
  CANCELADO: "oklch(0.60 0.04 25)",
};

const STATUS_LABELS: Record<string, string> = {
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

interface Props {
  byStatus: { status: string; n: number }[];
  totalItems: number;
}

export function RelatoriosCharts({ byStatus, totalItems }: Props) {
  if (totalItems === 0) {
    return <div style={{ padding: "20px 0", color: "var(--fg-faint)", fontSize: 12 }}>Sem dados.</div>;
  }

  const max = Math.max(...byStatus.map((s) => s.n));
  const h = 130;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: h, marginBottom: 8 }}>
        {byStatus.map((s) => {
          const bh = Math.max(4, (s.n / max) * (h - 24));
          const color = STATUS_COLORS[s.status] ?? "var(--accent)";
          return (
            <div key={s.status} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, height: "100%" }}>
              <span style={{ fontSize: 10, color: "var(--fg-dim)", fontVariantNumeric: "tabular-nums" }}>{s.n}</span>
              <div style={{ width: "100%", maxWidth: 48, height: bh, borderRadius: "4px 4px 0 0", background: color }} />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 6, borderTop: "1px solid var(--line)", paddingTop: 6 }}>
        {byStatus.map((s) => (
          <div key={s.status} style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 9.5, color: "var(--fg-faint)", fontFamily: "var(--font-mono)", lineHeight: 1.3, wordBreak: "break-word" }}>
              {STATUS_LABELS[s.status] ?? s.status}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
        {byStatus.map((s) => {
          const pct = ((s.n / totalItems) * 100).toFixed(0);
          return (
            <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[s.status] ?? "var(--accent)", flexShrink: 0 }} />
              <span style={{ color: "var(--fg-dim)" }}>{STATUS_LABELS[s.status] ?? s.status}</span>
              <span className="mono" style={{ color: "var(--fg-faint)" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
