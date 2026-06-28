"use client";

import {
  ResponsiveContainer, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";

export interface CrsPoint {
  date: string;   // YYYY-MM-DD
  crs: number;    // 0-6
  signal: boolean;
}

interface Props {
  data: CrsPoint[];
}

const TICK_STYLE = {
  fill: "#64748b",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
};

function barColor(crs: number): string {
  if (crs >= 5) return "#c084fc"; // violet
  if (crs >= 4) return "#f87171"; // red
  if (crs >= 3) return "#fb923c"; // orange
  if (crs >= 2) return "#fbbf24"; // amber
  if (crs >= 1) return "#6ee7b7"; // light green
  return "#1e293b";               // very dark (0)
}

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; payload: CrsPoint }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.22] bg-[#0a1628]/95 px-3 py-2 backdrop-blur-md text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p style={{ color: barColor(p.crs) }}>CRS: {p.crs}/6</p>
      {p.signal && <p className="text-[#34d399] mt-0.5">phi2 発動</p>}
    </div>
  );
};

// 表示する X 軸ラベル（月初のみ）
function getTickDates(data: CrsPoint[]): string[] {
  return data
    .filter((d) => d.date.slice(8) <= "05")
    .map((d) => d.date)
    .filter((d, i, arr) => arr.indexOf(d) === i);
}

export default function CrsHistoryChart({ data }: Props) {
  const tickDates = getTickDates(data);

  const avgCrs = data.length > 0
    ? (data.reduce((s, d) => s + d.crs, 0) / data.length).toFixed(1)
    : "0";

  const highDays = data.filter((d) => d.crs >= 4).length;

  return (
    <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            直近 90 日 · CRS スコア推移
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#e8f4ff]">
            恐怖がいつ高まっていたか
          </p>
        </div>
        <div className="flex gap-3 text-right">
          <div>
            <p className="font-mono text-[10px] text-slate-500">平均 CRS</p>
            <p className="font-mono text-lg font-bold text-slate-300">{avgCrs}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] text-slate-500">高CRS日数</p>
            <p className="font-mono text-lg font-bold text-amber-400">{highDays}日</p>
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 2, right: 8, left: -20, bottom: 0 }} barGap={0}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
          <XAxis
            dataKey="date"
            ticks={tickDates}
            tickFormatter={(v: string) => v.slice(5, 10).replace("-", "/")}
            tick={TICK_STYLE}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 6]}
            ticks={[0, 2, 4, 6]}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
          <Bar dataKey="crs" radius={[2, 2, 0, 0]} maxBarSize={8}>
            {data.map((d, i) => (
              <Cell key={i} fill={barColor(d.crs)} opacity={d.signal ? 1 : 0.7} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* 色凡例 */}
      <div className="mt-3 flex flex-wrap gap-3 font-mono text-[10px]">
        {[
          { c: 6, label: "5-6 最高警戒（買いの最高品質ゾーン）", color: "#c084fc" },
          { c: 4, label: "3-4 高警戒",   color: "#f87171" },
          { c: 2, label: "2   シグナル有効最低ライン", color: "#fbbf24" },
          { c: 1, label: "0-1 平常",      color: "#6ee7b7" },
        ].map(({ c, label, color }) => (
          <span key={c} style={{ color }} className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
