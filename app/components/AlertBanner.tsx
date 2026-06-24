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
    glow: "shadow-[0_0_40px_rgba(167,139,250,0.3)] border-violet-400/40",
    bar: "bg-gradient-to-r from-violet-500/20 via-violet-500/10 to-transparent",
    dot: "bg-violet-400",
    label: "phi2 v3 + RSI<25 同時発動 — 30年8回の超高品質シグナル",
  },
  PHI2: {
    glow: "shadow-[0_0_40px_rgba(52,211,153,0.3)] border-emerald-400/40",
    bar: "bg-gradient-to-r from-emerald-500/20 via-emerald-500/10 to-transparent",
    dot: "bg-emerald-400",
    label: "phi2 v3 発動 — 追加投入シグナル",
  },
  HYG8: {
    glow: "shadow-[0_0_40px_rgba(251,191,36,0.3)] border-amber-400/40",
    bar: "bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent",
    dot: "bg-amber-400",
    label: "HYG-8% QE後シグナル発動",
  },
  B4: {
    glow: "shadow-[0_0_40px_rgba(56,189,248,0.3)] border-sky-400/40",
    bar: "bg-gradient-to-r from-sky-500/20 via-sky-500/10 to-transparent",
    dot: "bg-sky-400",
    label: "B4 phi2 追加フォロー発動",
  },
  RSI25: {
    glow: "shadow-[0_0_30px_rgba(251,191,36,0.2)] border-amber-400/30",
    bar: "bg-gradient-to-r from-amber-500/15 via-amber-500/8 to-transparent",
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
    <div className={`border-b backdrop-blur-sm ${cfg.glow} ${cfg.bar}`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-2.5">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className={`absolute inline-flex h-full w-full rounded-full opacity-60 ping-slow ${cfg.dot}`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
          </span>
          <span className="font-mono text-xs font-semibold tracking-wide text-[#e8f4ff]">
            {cfg.label}
          </span>
          <span className="hidden font-mono text-[10px] text-slate-400 sm:block">
            ATH {pct(athDd)} · CRS {crs}/6
          </span>
        </div>
        <Link
          href="/signal"
          className="shrink-0 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-1 font-mono text-[10px] text-slate-300 hover:bg-white/10 hover:text-white transition-colors tracking-wider backdrop-blur-sm"
        >
          詳細 →
        </Link>
      </div>
    </div>
  );
}
