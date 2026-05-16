"use client";

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: "var(--line-strong)",
  COTACAO_EM_ANDAMENTO: "oklch(0.72 0.06 260)",
  COTACAO_CONCLUIDA: "oklch(0.62 0.08 250)",
  CONTRATADO: "oklch(0.50 0.10 240)",
  ENTREGA_PARCIAL: "oklch(0.68 0.13 75)",
  ENTREGUE: "oklch(0.58 0.12 95)",
  NF_RECEBIDA: "oklch(0.58 0.11 130)",
  EM_TESTE: "oklch(0.56 0.11 165)",
  CONCLUIDO: "var(--accent)",
  CANCELADO: "var(--danger)",
};

interface DistItem { status: string; label: string; qtd: number }

export function DashboardCharts({ dist }: { dist: DistItem[] }) {
  const total = dist.reduce((a, b) => a + b.qtd, 0);
  const r = 56;
  const c = 2 * Math.PI * r;
  let acc = 0;

  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <svg viewBox="-80 -80 160 160" width="140" height="140" style={{ flexShrink: 0, transform: "rotate(-90deg)" }}>
        <circle r={r} cx="0" cy="0" fill="none" stroke="var(--line-soft)" strokeWidth="20" />
        {dist.map((d, i) => {
          const frac = d.qtd / total;
          const dash = c * frac;
          const offset = c - acc;
          acc += dash;
          return (
            <circle key={i} r={r} cx="0" cy="0" fill="none"
              stroke={STATUS_COLORS[d.status] ?? "var(--line-strong)"} strokeWidth="20"
              strokeDasharray={`${dash} ${c}`}
              strokeDashoffset={offset}
            />
          );
        })}
        <circle r={r - 12} cx="0" cy="0" fill="var(--bg-panel)" />
      </svg>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {dist.map((d) => (
          <div key={d.status} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: STATUS_COLORS[d.status] ?? "var(--line-strong)", flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--fg-mid)" }}>{d.label}</span>
            <span className="mono" style={{ color: "var(--fg)", fontWeight: 500 }}>{d.qtd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
