"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Average score (0–10) per class. */
export function ClassScoreChart({ data }: { data: { code: string; average: number | null; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, value: d.average ?? 0 }));
  return (
    <div className="h-56 w-full" role="img" aria-label={`Điểm trung bình: ${data.map((d) => `${d.code} ${d.average ?? "chưa có"}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 20, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" />
          <XAxis dataKey="code" tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} />
          <YAxis domain={[0, 10]} ticks={[0, 5, 10]} tickLine={false} axisLine={false} tick={{ fill: "var(--ink-muted)", fontSize: 12 }} />
          <Tooltip
            cursor={{ fill: "var(--sky-50)" }}
            formatter={(value, _name, item) => [item.payload.average === null ? "Chưa có bài chấm" : `${String(value).replace(".", ",")} / 10`, "Điểm TB"]}
            contentStyle={{ borderRadius: 10, border: "1px solid var(--line)", fontSize: 13 }}
          />
          <Bar dataKey="value" fill="var(--blue-600)" radius={[6, 6, 0, 0]} maxBarSize={48} isAnimationActive={false}>
            <LabelList dataKey="average" position="top" formatter={(v) => (v === null || v === undefined ? "" : String(v).replace(".", ","))} style={{ fill: "var(--ink)", fontSize: 12, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
