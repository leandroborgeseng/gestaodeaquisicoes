"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface Props {
  data: { mes: string; valor: number }[];
}

function fmtBRLShort(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$${(v / 1_000).toFixed(0)}k`;
  return `R$${v.toFixed(0)}`;
}

export function FinanceChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart
        data={data}
        margin={{ top: 6, right: 16, left: 0, bottom: 0 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--line-soft)"
          vertical={false}
        />
        <XAxis
          dataKey="mes"
          tick={{ fontSize: 11, fill: "var(--fg-dim)" }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={fmtBRLShort}
          tick={{ fontSize: 10, fill: "var(--fg-dim)" }}
          tickLine={false}
          axisLine={false}
          width={54}
        />
        <Tooltip
          contentStyle={{
            background: "var(--bg-panel)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--fg)",
          }}
          formatter={(value) => [
            Number(value ?? 0).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
              minimumFractionDigits: 2,
            }),
            "Valor contratado",
          ]}
          labelStyle={{ color: "var(--fg-mid)", marginBottom: 2 }}
        />
        <Line
          type="monotone"
          dataKey="valor"
          stroke="#1A57B0"
          strokeWidth={2}
          dot={{ r: 3, fill: "#1A57B0", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#1A57B0", strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
