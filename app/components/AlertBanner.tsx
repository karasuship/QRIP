import Link from "next/link";
import type { SignalData } from "@/lib/signal";

function pct(n: number): string {
  return (n * 100).toFixed(2) + "%";
}

type BannerConfig = {
  bg: string;
  border: string;
  dot: string;
  label: string;
};

const CONFIGS: Record<string, BannerConfig> = {
  DOUBLE: {
    bg: "bg-violet-700 dark:bg-violet-800",
    border: "border-violet-500",
    dot: "bg-white",
    label: "🔴 phi2 v3 + RSI<25 同時発動（超高品質 · 30年8回）",
  },
  PHI2: {
    bg: "bg-red-600 dark:bg-red-700",
    border: "border-red-400",
    dot: "bg-white",
    label: "⚡ phi2 v3 発動 — 追加投入シグナル",
  },
  HYG8: {
    bg: "bg-orange-600 dark:bg-orange-700",
    border: "border-orange-400",
    dot: "bg-white",
    label: "⚡ HYG-8% QE後シグナル発動",
  },
  B4: {
    bg: "bg-blue-600 dark:bg-blue-700",
    border: "border-blue-400",
    dot: "bg-white",
    label: "⚡ B4 phi2追加フォロー発動",
  },
  RSI25: {
    bg: "bg-amber-600 dark:bg-amber-700",
    border: "border-amber-400",
    dot: "bg-white",
    label: "📊 RSI<25 クロスアンダー",
  },
};

export default function AlertBanner({ signal }: { signal: SignalData }) {
  const { signalTier, hygSignal, b4Active, athDd, crs, date } = signal;

  // 発動中シグナルを優先度順に選ぶ
  let key: string | null = null;
  if (signalTier === "DOUBLE") key = "DOUBLE";
  else if (signalTier === "PHI2") key = "PHI2";
  else if (hygSignal) key = "HYG8";
  else if (b4Active) key = "B4";
  else if (signalTier === "RSI25") key = "RSI25";

  if (!key) return null;

  const cfg = CONFIGS[key];

  return (
    <div className={`${cfg.bg} border-b ${cfg.border}`}>
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className={`relative flex h-2.5 w-2.5 shrink-0`}>
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-60`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${cfg.dot}`} />
          </span>
          <span className="text-sm font-semibold text-white">
            {cfg.label}
          </span>
          <span className="hidden text-xs text-white/70 sm:inline">
            ATH {pct(athDd)} · CRS {crs}/6 · {date}
          </span>
        </div>
        <Link
          href="/signal"
          className="shrink-0 rounded-full bg-white/20 px-3 py-0.5 text-xs font-medium text-white hover:bg-white/30 transition-colors"
        >
          詳細 →
        </Link>
      </div>
    </div>
  );
}
