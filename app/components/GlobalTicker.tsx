"use client";

import { useEffect, useState } from "react";

interface MiniSignal {
  athDd: number;
  crs: number;
  vix: number | null;
  price: number;
  signalTier: string;
  date: string;
}

const TIER_LABEL: Record<string, string> = {
  DOUBLE: "◉ シグナル 超高品質",
  PHI2:   "● シグナル 発動中",
  RSI25:  "◎ 補助シグナル発動",
  NEAR:   "○ 発動圏内",
  NONE:   "○ 待機中",
};

const TIER_COLOR: Record<string, string> = {
  DOUBLE: "text-violet-300",
  PHI2:   "text-[#34d399]",
  RSI25:  "text-amber-400",
  NEAR:   "text-amber-400/70",
  NONE:   "text-slate-500",
};

function fmt(n: number, digits = 2): string {
  const s = (n * 100).toFixed(digits);
  return n >= 0 ? "+" + s + "%" : s + "%";
}

export function GlobalTicker() {
  const [data, setData] = useState<MiniSignal | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/signal-mini")
        .then((r) => r.json())
        .then((d: MiniSignal & { error?: string }) => { if (!d.error) setData(d); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const items = [
    { label: "S&P500 ATH乖離", value: fmt(data.athDd),             color: data.athDd <= -0.10 ? "text-[#34d399]" : data.athDd <= -0.05 ? "text-amber-400" : "text-[#e8f4ff]" },
    { label: "CRS スコア",      value: `${data.crs} / 6`,           color: data.crs >= 4 ? "text-violet-300" : data.crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]" },
    { label: "VIX",             value: data.vix ? data.vix.toFixed(1) : "—", color: (data.vix ?? 0) > 30 ? "text-[#f87171]" : "text-[#e8f4ff]" },
    { label: "S&P500",          value: data.price ? `$${Math.round(data.price).toLocaleString()}` : "—", color: "text-[#e8f4ff]" },
    { label: "状態",             value: TIER_LABEL[data.signalTier] ?? "—", color: TIER_COLOR[data.signalTier] ?? "text-slate-500" },
    { label: "取得日",           value: data.date,                  color: "text-slate-500" },
  ];

  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-white/[0.06] bg-[#010810]/90">
      <div className="flex animate-ticker whitespace-nowrap py-1">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-baseline gap-2 px-7">
            <span className="font-mono text-[8px] uppercase tracking-[0.18em] text-slate-600">
              {item.label}
            </span>
            <span className={`font-mono text-[10px] font-bold tabular-nums ${item.color}`}>
              {item.value}
            </span>
            <span className="text-slate-700 text-[8px]">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
