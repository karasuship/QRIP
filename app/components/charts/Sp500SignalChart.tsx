"use client";

import {
  ResponsiveContainer, ComposedChart,
  Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine,
} from "recharts";
import type { Sp500Point } from "@/lib/sim-compute";

interface Props {
  data: Sp500Point[];
  currentCrs: number;
}

const TICK_STYLE = {
  fill: "#64748b",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
};

// SP500 直近 180 日 + phi2 シグナルマーカーを重ねるチャート
// signal ページ用

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; payload: Sp500Point }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0a1628]/95 px-3 py-2.5 backdrop-blur-md text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1">{label}</p>
      <p className="text-[#e8f4ff]">SP500: {payload[0].value.toLocaleString()}</p>
      <p className={`${p.crs >= 4 ? "text-[#f87171]" : p.crs >= 2 ? "text-amber-400" : "text-slate-500"}`}>
        CRS: {p.crs}/6
      </p>
      {p.signal && (
        <p className="text-[#34d399] font-semibold mt-0.5">▲ phi2 発動</p>
      )}
    </div>
  );
};

// データを間引く（表示用：60日より多い場合は週次に）
function thin(data: Sp500Point[]): Sp500Point[] {
  if (data.length <= 90) return data;
  return data.filter((_, i) => i % 3 === 0 || data[i].signal);
}

export default function Sp500SignalChart({ data, currentCrs }: Props) {
  const thinned = thin(data);
  const signalDates = data.filter((d) => d.signal);

  // X 軸ラベル：月初のみ
  const tickDates = thinned
    .filter((d, i) => i === 0 || d.date.slice(8) <= "05")
    .map((d) => d.date)
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .slice(0, 12);

  const prices = thinned.map((d) => d.price);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const yPad = (maxP - minP) * 0.05;

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            直近 180 日 · SP500 価格
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#e8f4ff]">
            どのタイミングで買い場シグナルが出たか
          </p>
        </div>
        <div className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
          currentCrs >= 4 ? "border-[#f87171]/40 text-[#f87171]" :
          currentCrs >= 2 ? "border-amber-400/40 text-amber-400" :
          "border-white/[0.18] text-slate-500"
        }`}>
          CRS {currentCrs}/6
        </div>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={thinned} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="sp500Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.12} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            ticks={tickDates}
            tickFormatter={(v: string) => v.slice(5, 10).replace("-", "/")}
            tick={TICK_STYLE}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
          />
          <YAxis
            domain={[minP - yPad, maxP + yPad]}
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(Math.round(v))}
          />
          <Tooltip content={<CustomTooltip />} />

          <Line
            type="monotone"
            dataKey="price"
            stroke="#38bdf8"
            strokeWidth={1.5}
            dot={false}
          />

          {/* phi2 シグナル縦線 */}
          {signalDates.map((s) => (
            <ReferenceLine
              key={s.date}
              x={s.date}
              stroke="#34d399"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              opacity={0.7}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px]">
        <span className="flex items-center gap-1.5 text-[#38bdf8]">
          <span className="inline-block h-0.5 w-5 bg-[#38bdf8]" />
          SP500 価格
        </span>
        <span className="flex items-center gap-1.5 text-[#34d399]">
          <span className="inline-block h-3 w-0.5 bg-[#34d399]" />
          phi2 買い場シグナル
        </span>
        {signalDates.length === 0 && (
          <span className="text-slate-600">直近 180 日にシグナルはありませんでした</span>
        )}
      </div>
    </div>
  );
}
