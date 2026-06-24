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

function MetricTile({
  label, value, sub, numValue, state,
}: {
  label: string;
  value: string;
  sub: string;
  numValue?: number | null;
  state?: "active" | "warn" | "dim" | "default";
}) {
  const flash = useFlash(numValue ?? null);

  const borderCls =
    flash === "up"      ? "border-[#34d399]/50 glow-green" :
    flash === "down"    ? "border-[#f87171]/50 glow-red"   :
    state === "active"  ? "border-[#34d399]/35 glow-green" :
    state === "warn"    ? "border-amber-400/35 glow-amber" :
    state === "dim"     ? "border-white/[0.04]"             :
    "border-white/[0.08]";

  const valueCls =
    flash === "up"      ? "text-glow-green" :
    flash === "down"    ? "text-glow-red"   :
    state === "active"  ? "text-[#34d399]"  :
    state === "warn"    ? "text-amber-400"  :
    state === "dim"     ? "text-white/20"   :
    "text-[#e8f4ff]";

  return (
    <div className={`rounded-2xl border bg-white/[0.05] p-3.5 backdrop-blur-md transition-all duration-300 ${borderCls}`}>
      <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">{label}</p>
      <p className={`mt-1 font-mono text-lg tabular-nums transition-colors duration-200 ${valueCls}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[10px] text-white/25">{sub}</p>
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
        if (res.ok) { setData(await res.json()); setLastUpdate(new Date()); }
      } finally { setLoading(false); }
    };
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const { price, athDd, ageAth, ageAthOk, vol20, dayRet, rsi14, vix } = data;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/25">ライブ指標</p>
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/25">
          {loading && <span className="h-1 w-1 rounded-full bg-[#38bdf8] animate-pulse" />}
          {lastUpdate.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricTile
          label="SP500"
          value={price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          sub={dayRet !== null ? `前日比 ${pct(dayRet)}` : ""}
          numValue={price}
          state={dayRet !== null && dayRet <= -0.02 ? "warn" : dayRet !== null && dayRet > 0 ? "active" : "default"}
        />
        <MetricTile
          label="ATH 乖離"
          value={pct(athDd)}
          sub="≤ −10% で phi2 圏内"
          numValue={athDd}
          state={athDd <= -0.1 ? "warn" : "default"}
        />
        <MetricTile
          label="ATH からの日数"
          value={`${ageAth}日`}
          sub={ageAthOk ? "フィルタ OK" : "除外 [91-252]"}
          numValue={ageAth}
          state={!ageAthOk ? "dim" : "default"}
        />
        <MetricTile
          label="vol20（年率）"
          value={vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}
          sub="> 25% で条件達成"
          numValue={vol20}
          state={vol20 !== null && vol20 > 0.25 ? "active" : "default"}
        />
        <MetricTile
          label="当日リターン"
          value={dayRet !== null ? pct(dayRet) : "—"}
          sub="≤ −2% で条件達成"
          numValue={dayRet}
          state={dayRet !== null && dayRet <= -0.02 ? "active" : "default"}
        />
        <MetricTile
          label="RSI14"
          value={rsi14 !== null ? rsi14.toFixed(1) : "—"}
          sub={rsi14 !== null && rsi14 < 25 ? "< 25 シグナル域" : "> 25 通常域"}
          numValue={rsi14}
          state={rsi14 !== null && rsi14 < 25 ? "warn" : "default"}
        />
        {vix !== null && (
          <MetricTile
            label="VIX"
            value={vix.toFixed(1)}
            sub={vix > 30 ? "CRS C1 達成 (>30)" : "通常域 (≤30)"}
            numValue={vix}
            state={vix > 30 ? "warn" : "default"}
          />
        )}
      </div>
    </div>
  );
}
