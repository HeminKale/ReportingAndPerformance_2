"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface TrendDatum {
  label: string;
  count: number;
}

interface CompletionTrendsChartProps {
  data: TrendDatum[];
}

export function CompletionTrendsChart({ data }: CompletionTrendsChartProps) {
  if (!data.length) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 text-sm text-slate-500">
        No completions this week yet
      </div>
    );
  }

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} width={28} />
          <Tooltip
            contentStyle={{
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.06)",
            }}
            labelStyle={{ fontWeight: 600 }}
          />
          <Bar
            dataKey="count"
            name="Tasks"
            fill="url(#barGrad)"
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
          />
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
