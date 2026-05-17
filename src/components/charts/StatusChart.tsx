"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { STATUS_LABELS } from "@/lib/utils";

interface Props {
  data: { status: string; count: number }[];
}

export function StatusChart({ data }: Props) {
  const chartData = data.map((d) => ({
    label: STATUS_LABELS[d.status] ?? d.status,
    count: d.count,
    status: d.status,
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: "var(--fg-dim)" }}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={110}
          tick={{ fontSize: 11, fill: "var(--fg-mid)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          cursor={{ fill: "var(--accent-soft)" }}
          contentStyle={{
            background: "var(--bg-panel)",
            border: "1px solid var(--line)",
            borderRadius: 6,
            fontSize: 12,
            color: "var(--fg)",
          }}
          formatter={(value) => [Number(value ?? 0), "Itens"]}
          labelStyle={{ color: "var(--fg-mid)", marginBottom: 2 }}
        />
        <Bar dataKey="count" radius={[0, 3, 3, 0]} fill="#1A57B0">
          {chartData.map((_, i) => (
            <Cell key={i} fill="#1A57B0" />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
