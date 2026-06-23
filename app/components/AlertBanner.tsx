import Link from "next/link";
import type { SignalData } from "@/lib/signal";

function pct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

type BannerConfig = {
  glow: string;
  bar: string;
  dot: string;
  label: string;
};

const CONFIGS: Record<string, BannerConfig> = {
  DOUBLE: {
    glow: "shadow-[0_0_30px_rgba(139,92,246,0.4)] border-violet-500/60",
    bar: "bg-gradient-to-r from-violet-900/80 via-violet-800/60 to-[#050508]",
    dot: "bg-violet-400",
    label: "phi2 v3 + RSI<25 同時発動 — 30年8回の超高品質シグナル",
  },
  PHI2: {
    glow: "shadow-[0_0_30px_rgba(16,185,129,0.4)] border-emerald-500/60",
    bar: "bg-gradient-to-r from-emerald-900/80 via-emerald-900/40 to-[#050508]",
    dot: "bg-emerald-400",
    label: "phi2 v3 発動 — 追加投入シグナル",
  },
  HYG8: {
    glow: "shadow-[0_0_30px_rgba(245,158,11,0.4)] border-amber-500/60",
    bar: "bg-gradient-to-r from-amber-900/80 via-amber-900/40 to-[#050508]",
    dot: "bg-amber-400",
    label: "HYG-8% QE後シグナル発動",
  },
  B4: {
    glow: "shadow-[0_0_30px_rgba(6,182,212,0.4)] border-cyan-500/60",
    bar: "bg-gradient-to-r from-cyan-900/80 via-cyan-900/40 to-[#050508]",
    dot: "bg-cyan-400",
    label: "B4 phi2 追加フォロー発動",
  },
  RSI25: {
    glow: "shadow-[0_0_20px_rgba(245,158,11,0.3)] border-amber-600/50",
    bar: "bg-gradient-to-r from-amber-900/60 via-amber-900/30 to-[#050508]",
    dot: "bg-amber-500",
    label: "RSI<25 クロスアンダー",
  },
};

export default function AlertBanner({ signal }: { signal: SignalData }) {
  const { signalTier, hygSignal, b4Active, athDd, crs } = signal;

  let key: string | null = null;
  if (signalTier === "DOUBLE") key = "DOUBLE";
  else if (signalTier === "PHI2") key = "PHI2";
  else if (hygSignal) key = "HYG8";
  else if (b4Active) key = "B4";
  else if (signalTier === "RSI25") key = "RSI25";

  if (!key) return null;

  const cfg = CONFIGS[key];

  return (
    <div className={`border-b ${cfg.glow} ${cfg.bar}`}>
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-2.5">
        <div className="flex items-center gap-3">
          {/* Pinging dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full ${cfg.dot} opacity-50 ping-slow`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
          </span>
          <span className="font-mono text-xs font-semibold tracking-wide text-[#e2e8f0]">
            {cfg.label}
          </span>
          <span className="hidden text-[10px] font-mono text-[#64748b] sm:block">
            ATH {pct(athDd)} · CRS {crs}/6
          </span>
        </div>
        <Link
          href="/signal"
          className="shrink-0 rounded border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] text-[#94a3b8] hover:bg-white/10 hover:text-white transition-colors tracking-wider"
        >
          詳細 →
        </Link>
      </div>
    </div>
  );
}
