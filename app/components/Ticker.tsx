"use client";

import { useEffect, useRef, useState } from "react";
import type { SignalData } from "@/lib/signal";

const POLL_MS = 60_000;

function pct(n: number) {
  const s = (Math.abs(n) * 100).toFixed(2) + "%";
  return n >= 0 ? "▲" + s : "▼" + s;
}

interface TickerItem {
  label: string;
  value: string;
  change?: number | null;
  alert?: boolean;
}

function buildItems(d: SignalData): TickerItem[] {
  return [
    { label: "SP500",  value: d.price.toLocaleString("en-US", { minimumFractionDigits: 2 }), change: d.dayRet },
    { label: "ATH乖離", value: (d.athDd * 100).toFixed(2) + "%", change: null },
    { label: "VIX",    value: d.vix !== null ? d.vix.toFixed(2) : "—", change: null },
    { label: "RSI14",  value: d.rsi14 !== null ? d.rsi14.toFixed(1) : "—", change: null },
    { label: "vol20",  value: d.vol20 !== null ? (d.vol20 * 100).toFixed(1) + "%" : "—", change: null },
    { label: "CRS",    value: `${d.crs}/6`, change: null },
    { label: "SIGNAL", value: d.signalTier, change: null, alert: d.signalTier !== "NONE" },
  ];
}

export default function Ticker({ initial }: { initial: SignalData }) {
  const [data, setData] = useState<SignalData>(initial);
  const prevRef = useRef<SignalData>(initial);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/signal", { cache: "no-store" });
        if (res.ok) {
          prevRef.current = data;
          setData(await res.json());
        }
      } catch { /* silent */ }
    };
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [data]);

  const items = buildItems(data);
  const doubled = [...items, ...items];

  return (
    <div className="overflow-hidden border-b border-white/[0.05] bg-white/[0.02] py-1.5 backdrop-blur-sm">
      <div className="flex overflow-hidden">
        <div className="flex animate-ticker whitespace-nowrap">
          {doubled.map((item, i) => (
            <span key={i} className="inline-flex items-center gap-2 border-r border-white/[0.05] px-6">
              <span className="font-mono text-[10px] uppercase tracking-widest text-white/20">
                {item.label}
              </span>
              <span className={`font-mono text-xs tabular-nums ${
                item.alert
                  ? "text-amber-400"
                  : item.change !== null && item.change !== undefined
                    ? item.change > 0
                      ? "text-[#34d399]"
                      : item.change < 0
                        ? "text-[#f87171]"
                        : "text-slate-400"
                    : "text-slate-400"
              }`}>
                {item.change !== null && item.change !== undefined
                  ? `${item.value} ${pct(item.change)}`
                  : item.value}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
