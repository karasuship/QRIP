"use client";

import { useEffect, useRef, useState } from "react";
import type { SignalData } from "@/lib/signal";

const POLL_MS = 60_000;

function useFlash(value: number | null) {
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const prev = useRef<number | null>(null);

  useEffect(() => {
    if (value === null || prev.current === null) { prev.current = value; return; }
    if (value > prev.current) setFlash("up");
    else if (value < prev.current) setFlash("down");
    prev.current = value;
    const t = setTimeout(() => setFlash(null), 800);
    return () => clearTimeout(t);
  }, [value]);

  return flash;
}

function FlashCell({
  label, value, sub, numValue, warn, highlight,
}: {
  label: string;
  value: string;
  sub: string;
  numValue?: number | null;
  warn?: boolean;
  highlight?: boolean;
}) {
  const flash = useFlash(numValue ?? null);
  const flashCls =
    flash === "up" ? "bg-emerald-100 dark:bg-emerald-900/50" :
    flash === "down" ? "bg-red-100 dark:bg-red-900/50" :
    "";

  return (
    <div className={`rounded-lg border p-3 transition-colors duration-500 ${
      highlight ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950" :
      warn ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950" :
      "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    } ${flashCls}`}>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums transition-colors duration-300 ${
        flash === "up" ? "text-emerald-600 dark:text-emerald-400" :
        flash === "down" ? "text-red-500 dark:text-red-400" :
        highlight ? "text-emerald-700 dark:text-emerald-300" :
        warn ? "text-amber-600 dark:text-amber-400" :
        "text-zinc-900 dark:text-zinc-100"
      }`}>{value}</p>
      <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>
    </div>
  );
}

function pct(n: number, sign = true) {
  const s = (n * 100).toFixed(2) + "%";
  return sign && n >= 0 ? "+" + s : s;
}

export default function LiveMetrics({ initial }: { initial: SignalData }) {
  const [data, setData] = useState<SignalData>(initial);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const poll = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/signal", { cache: "no-store" });
        if (res.ok) {
          const json: SignalData = await res.json();
          setData(json);
          setLastUpdate(new Date());
        }
      } finally {
        setLoading(false);
      }
    };
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const { price, athDd, ageAth, ageAthOk, vol20, dayRet, rsi14, vix } = data;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">指標</p>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          {loading && (
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-zinc-400" />
          )}
          {lastUpdate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })} 更新
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <FlashCell
          label="SP500"
          value={price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          sub={dayRet !== null ? `前日比 ${pct(dayRet)}` : ""}
          numValue={price}
          highlight={dayRet !== null && dayRet > 0}
          warn={dayRet !== null && dayRet <= -0.02}
        />
        <FlashCell
          label="ATH 乖離"
          value={pct(athDd)}
          sub="≤ −10% で phi2 圏内"
          numValue={athDd}
          warn={athDd <= -0.1}
        />
        <FlashCell
          label="ATH からの日数"
          value={`${ageAth}日`}
          sub={ageAthOk ? "フィルタ OK" : "除外ゾーン [91-252]"}
          numValue={ageAth}
          warn={!ageAthOk}
        />
        <FlashCell
          label="vol20（年率）"
          value={vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}
          sub="> 25% で条件達成"
          numValue={vol20}
          highlight={vol20 !== null && vol20 > 0.25}
        />
        <FlashCell
          label="当日リターン"
          value={dayRet !== null ? pct(dayRet) : "—"}
          sub="≤ −2% で条件達成"
          numValue={dayRet}
          highlight={dayRet !== null && dayRet <= -0.02}
          warn={dayRet !== null && dayRet < 0 && dayRet > -0.02}
        />
        <FlashCell
          label="RSI14"
          value={rsi14 !== null ? rsi14.toFixed(1) : "—"}
          sub={rsi14 !== null && rsi14 < 25 ? "< 25（シグナル域）" : "通常域（> 25）"}
          numValue={rsi14}
          warn={rsi14 !== null && rsi14 < 25}
        />
        {vix !== null && (
          <FlashCell
            label="VIX"
            value={vix.toFixed(1)}
            sub={vix > 30 ? "CRS C1 達成（>30）" : "通常域（≤ 30）"}
            numValue={vix}
            warn={vix > 30}
          />
        )}
      </div>
    </div>
  );
}
