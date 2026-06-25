"use client";

import {
  ResponsiveContainer, ComposedChart,
  Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceDot, Legend,
} from "recharts";
// JSON から直接読み込む軽量な型（CSV 依存なし）
export interface SimMonthly {
  date: string;  // YYYY-MM
  dca: number;
  phi2: number;
  sp500: number;
}

export interface Phi2Signal {
  date: string;  // YYYY-MM-DD
  price: number;
  crs: number;
  athDd: number;
}

interface Props {
  monthly: SimMonthly[];
  signals: Phi2Signal[];
  dcaFinal: number;
  phi2Final: number;
  alpha: number;
}

const TICK_STYLE = {
  fill: "#64748b",
  fontSize: 10,
  fontFamily: "ui-monospace, monospace",
};

// グラフに表示するシグナルマーカー（月次データにある月のもののみ）
function filterSignals(signals: Phi2Signal[], monthly: SimMonthly[]) {
  const monthSet = new Set(monthly.map((m) => m.date));
  return signals.filter((s) => monthSet.has(s.date.slice(0, 7)));
}

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: { value: number; dataKey: string; color: string }[];
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0a1628]/95 px-3 py-2.5 backdrop-blur-md text-xs font-mono shadow-xl">
      <p className="text-slate-400 mb-1.5">{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }} className="leading-5">
          {p.dataKey === "phi2"
            ? `phi2戦略: ${p.value.toFixed(1)}`
            : `毎月積立（DCA）: ${p.value.toFixed(1)}`}
        </p>
      ))}
    </div>
  );
};

export default function SimulationChart({ monthly, signals, dcaFinal, phi2Final, alpha }: Props) {
  // X 軸ラベル：1月のみ表示（5年おきにする）
  const tickDates = monthly
    .filter((m) => m.date.endsWith("-01") && parseInt(m.date.slice(0, 4)) % 4 === 0)
    .map((m) => m.date);

  // シグナル月を map にしてグラフデータに埋め込む
  const signalMonths = new Set(signals.map((s) => s.date.slice(0, 7)));
  const data = monthly.map((m) => ({
    ...m,
    hasSignal: signalMonths.has(m.date),
  }));

  const alphaSign = alpha > 0 ? "+" : "";

  return (
    <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 backdrop-blur-sm">
      {/* ヘッダ */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">
            2008〜2026 · シミュレーション
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[#e8f4ff]">
            毎月積立 vs phi2 追加投入
          </p>
          <p className="mt-1 text-[11px] text-slate-500 leading-5 max-w-md">
            どちらも毎月同額を積立。phi2 発動時にはさらに3倍分を追加投入した場合の比較。
            税金・手数料は含まない。
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-right">
            <p className="font-mono text-[10px] text-slate-500">毎月積立</p>
            <p className="font-mono text-xl font-bold text-slate-400">{dcaFinal.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] text-[#34d399]">phi2 追加</p>
            <p className="font-mono text-xl font-bold text-[#34d399]">{phi2Final.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] text-slate-500">差分</p>
            <p className={`font-mono text-xl font-bold ${alpha > 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
              {alphaSign}{alpha.toFixed(0)}
            </p>
          </div>
        </div>
      </div>

      {/* チャート */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="phi2Grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#34d399" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dcaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#38bdf8" stopOpacity={0.08} />
              <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
          <XAxis
            dataKey="date"
            ticks={tickDates}
            tickFormatter={(v: string) => v.slice(0, 4)}
            tick={TICK_STYLE}
            axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
            tickLine={false}
          />
          <YAxis
            tick={TICK_STYLE}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v.toFixed(0)}`}
          />
          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="phi2"
            stroke="#34d399"
            strokeWidth={2}
            fill="url(#phi2Grad)"
            dot={false}
            name="phi2"
          />
          <Area
            type="monotone"
            dataKey="dca"
            stroke="#38bdf8"
            strokeWidth={1.5}
            strokeDasharray="5 3"
            fill="url(#dcaGrad)"
            dot={false}
            name="dca"
          />

          {/* phi2 シグナルマーカー（■ 縦線で可視化） */}
          {signals.slice(0, 60).map((sig) => {
            const m = data.find((d) => d.date === sig.date.slice(0, 7));
            if (!m) return null;
            return (
              <ReferenceDot
                key={sig.date}
                x={m.date}
                y={m.phi2}
                r={3}
                fill="#34d399"
                stroke="none"
                opacity={0.8}
              />
            );
          })}
        </ComposedChart>
      </ResponsiveContainer>

      {/* 凡例 */}
      <div className="mt-3 flex flex-wrap gap-4 font-mono text-[10px]">
        <span className="flex items-center gap-1.5 text-[#34d399]">
          <span className="inline-block h-0.5 w-5 bg-[#34d399]" />
          phi2 追加投入戦略
        </span>
        <span className="flex items-center gap-1.5 text-[#38bdf8]">
          <span className="inline-block h-0.5 w-5 bg-[#38bdf8] opacity-70" style={{ borderTop: "2px dashed #38bdf8" }} />
          毎月積立（DCA）のみ
        </span>
        <span className="flex items-center gap-1.5 text-[#34d399] opacity-60">
          <span className="inline-block h-2 w-2 rounded-full bg-[#34d399]" />
          phi2 発動日
        </span>
      </div>

      <p className="mt-3 font-mono text-[10px] text-slate-700">
        ※ CSV から計算した再現値（2008〜2026）。phi2 追加投入は発動時に月次の3倍を即日投入と仮定。
        税金・手数料・スリッページは未考慮。実際の運用結果は異なります。
      </p>
    </div>
  );
}
