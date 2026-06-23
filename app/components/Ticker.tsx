"use client";

import { useEffect, useRef, useState } from "react";
import type { SignalData } from "@/lib/signal";

const POLL_MS = 60_000;

function pct(n: number) {
  const s = (Math.abs(n) * 100).toFixed(2) + "%";
  return n >= 0 ? "▲ " + s : "▼ " + s;
}

interface TickerItem {
  label: string;
  value: string;
  change?: number | null;
}

function buildItems(d: SignalData): TickerItem[] {
  return [
    { label: "SP500",   value: d.price.toLocaleString("en-US", { minimumFractionDigits: 2 }), change: d.dayRet },
    { label: "ATH乖離", value: (d.athDd * 100).toFixed(2) + "%", change: null },
    { label: "VIX",    value: d.vix !== null ? d.vix.toFixed(2) : "—", change: null },
    { label: "RSI14",  value: d.rsi14 !== null ? d.rsi14.toFixed(1) : "—", change: null },
    { label: "vol20",  value: d.vol20 !== null ? (d.vol20 * 100).toFixed(1) + "%" : "—", change: null },
    { label: "CRS",    value: `${d.crs}/6`, change: null },
    { label: "シグナル", value: d.signalTier, change: null },
  ];
}

function TickerRow({ items }: { items: TickerItem[] }) {
  const doubled = [...items, ...items]; // ループ用に2倍
  return (
    <div className="flex overflow-hidden">
      <div className="flex animate-ticker whitespace-nowrap">
        {doubled.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 px-5">
            <span className="text-xs font-medium text-zinc-400">{item.label}</span>
            <span className={`text-xs font-semibold tabular-nums ${
              item.change !== null && item.change !== undefined
                ? item.change > 0 ? "text-emerald-400" : item.change < 0 ? "text-red-400" : "text-zinc-300"
                : item.label === "シグナル" && item.value !== "NONE"
                  ? "text-amber-400"
                  : "text-zinc-300"
            }`}>
              {item.change !== null && item.change !== undefined
                ? `${item.value} ${pct(item.change)}`
                : item.value}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function Ticker({ initial }: { initial: SignalData }) {
  const [data, setData] = useState<SignalData>(initial);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/signal", { cache: "no-store" });
        if (res.ok) setData(await res.json());
      } catch { /* silent */ }
    };
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="border-b border-zinc-800 bg-zinc-950 py-1.5 overflow-hidden">
      <TickerRow items={buildItems(data)} />
    </div>
  );
}
