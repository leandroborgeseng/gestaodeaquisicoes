"use client";

const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul"];
const evolucao = [
  { mes: 0, ref: 0.4, ctr: 0.3 }, { mes: 1, ref: 1.8, ctr: 1.5 },
  { mes: 2, ref: 6.2, ctr: 5.4 }, { mes: 3, ref: 14.5, ctr: 13.1 },
  { mes: 4, ref: 19.4, ctr: 18.42, current: true },
  { mes: 5, ref: 23.1, ctr: null }, { mes: 6, ref: 25.0, ctr: null },
];

export function RelatoriosCharts() {
  const W = 560, H = 200, padL = 36, padR = 12, padT = 14, padB = 26;
  const maxY = 26;
  const x = (i: number) => padL + (i / (evolucao.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / maxY) * (H - padT - padB);

  const refPath = evolucao.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.ref)}`).join(" ");
  const ctrData = evolucao.filter((d) => d.ctr != null);
  const ctrPath = ctrData.map((d) => `${evolucao.indexOf(d) === 0 ? "M" : "L"} ${x(d.mes)} ${y(d.ctr!)}`).join(" ");
  const fillPath = ctrPath + ` L ${x(ctrData[ctrData.length - 1].mes)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const cur = evolucao.find((d) => d.current);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H, display: "block" }}>
      {[0, 5, 10, 15, 20, 25].map((v) => (
        <g key={v}>
          <line x1={padL} y1={y(v)} x2={W - padR} y2={y(v)} stroke="var(--line-soft)" />
          <text x={padL - 6} y={y(v) + 3} fontSize="9.5" fill="var(--fg-faint)" textAnchor="end" fontFamily="var(--font-mono)">{v === 0 ? "0" : v + "M"}</text>
        </g>
      ))}
      {evolucao.map((d, i) => (
        <text key={i} x={x(i)} y={H - padB + 14} fontSize="10" fill="var(--fg-dim)" textAnchor="middle" fontFamily="var(--font-mono)">{meses[i]}</text>
      ))}
      <path d={fillPath} fill="var(--accent)" opacity="0.08" />
      <path d={refPath} fill="none" stroke="var(--fg)" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="4 3" />
      <path d={ctrPath} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {ctrData.map((d, i) => (
        <circle key={i} cx={x(d.mes)} cy={y(d.ctr!)} r={d.current ? 4.5 : 3} fill="var(--bg-panel)" stroke="var(--accent)" strokeWidth="2" />
      ))}
      {cur && (
        <g>
          <line x1={x(cur.mes)} y1={y(cur.ctr!)} x2={x(cur.mes)} y2={H - padB} stroke="var(--accent)" strokeOpacity="0.3" strokeDasharray="2 3" />
          <g transform={`translate(${x(cur.mes) + 8}, ${y(cur.ctr!) - 14})`}>
            <rect x="0" y="0" width="78" height="22" rx="4" fill="var(--bg-panel)" stroke="var(--accent-line)" />
            <text x="6" y="14" fontSize="10.5" fill="var(--fg)" fontWeight="600" fontFamily="var(--font-mono)">R$ 18,42M</text>
          </g>
        </g>
      )}
    </svg>
  );
}
