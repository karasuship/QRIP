import Link from "next/link";
import { PORTFOLIO_PATTERNS, backtestAllPatterns, BacktestResult } from "@/lib/portfolio-backtest";

function fmtPct(n: number, forceSign = false) {
  return `${forceSign && n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function Pill({ ticker, weight }: { ticker: string; weight: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full border border-white/[0.12] bg-white/[0.04] px-1.5 py-0.5 font-mono text-[9px] text-slate-400">
      {ticker.replace(".T", "")}
      <span className="text-slate-600 ml-0.5">{Math.round(weight * 100)}%</span>
    </span>
  );
}

function PatternCard({
  pattern,
  result,
  isVoo,
}: {
  pattern: (typeof PORTFOLIO_PATTERNS)[number];
  result: BacktestResult;
  isVoo: boolean;
}) {
  const isSignal = pattern.backtestMode === "jp_signal";
  const beat = !isVoo && result.vsVoo > 0;
  const lag  = !isVoo && result.vsVoo < 0;

  return (
    <div
      className={`rounded-2xl border px-4 py-4 transition-all hover:brightness-110 ${
        isVoo
          ? "border-[#38bdf8]/20 bg-[#38bdf8]/[0.04]"
          : isSignal
          ? "border-[#34d399]/20 bg-[#34d399]/[0.03]"
          : "border-white/[0.18] bg-white/[0.06]"
      }`}
    >
      {/* タグ */}
      <div className="flex items-center gap-2">
        <span className={`inline-flex rounded-full border px-2 py-0.5 font-mono text-[9px] ${pattern.tagCls}`}>
          {pattern.tag}
        </span>
        {/* シグナル型：発動月数バッジ */}
        {isSignal && result.activatedMonths !== undefined && (
          <span className="font-mono text-[9px] text-slate-500">
            発動 {result.activatedMonths}/{result.months}ヶ月
          </span>
        )}
      </div>

      {/* 名前 */}
      <p className="mt-2 text-sm font-semibold text-[#e8f4ff] tracking-tight">{pattern.name}</p>

      {/* 構成 */}
      <div className="mt-1.5 flex flex-wrap gap-1">
        {pattern.assets.map((a) => (
          <Pill key={a.ticker} ticker={a.ticker} weight={a.weight} />
        ))}
      </div>

      {/* メイン指標 */}
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[9px] text-slate-500">元本比リターン</p>
          <p
            className={`font-mono text-2xl font-bold tabular-nums ${
              result.returnPct >= 0 ? "text-[#34d399]" : "text-[#f87171]"
            }`}
          >
            {fmtPct(result.returnPct, true)}
          </p>
        </div>

        {isVoo ? (
          <div className="text-right">
            <p className="font-mono text-[9px] text-slate-500">比較基準</p>
            <span className="rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/[0.06] px-2 py-0.5 font-mono text-[9px] text-[#38bdf8]/70">
              BENCHMARK
            </span>
          </div>
        ) : (
          <div className="text-right">
            <p className="font-mono text-[9px] text-slate-500">vs 全米</p>
            <p
              className={`font-mono text-sm font-semibold tabular-nums ${
                beat ? "text-[#34d399]" : lag ? "text-[#f87171]" : "text-slate-400"
              }`}
            >
              {fmtPct(result.vsVoo, true)}
            </p>
          </div>
        )}
      </div>

      {/* 年換算 */}
      <p className="mt-1 font-mono text-[9px] text-slate-600">
        年換算 {fmtPct(result.annualizedReturn, true)} · {result.months}ヶ月
      </p>

      {/* 補足 */}
      <p className="mt-2 text-[10px] leading-4 text-slate-600">{pattern.note}</p>
    </div>
  );
}

export default async function PortfolioPatterns() {
  let resultsMap: Map<string, BacktestResult>;
  try {
    resultsMap = await backtestAllPatterns();
  } catch {
    return null;
  }

  const patterns = PORTFOLIO_PATTERNS.map((p) => ({
    pattern: p,
    result: resultsMap.get(p.id) ?? {
      returnPct: 0, annualizedReturn: 0, vsVoo: 0, months: 0, ok: false,
    },
  })).filter(({ result }) => result.ok);

  if (patterns.length === 0) return null;

  const months = patterns[0].result.months;

  return (
    <section className="border-b border-white/[0.15]">
      <div className="mx-auto max-w-4xl px-6 py-8">

        <div className="flex items-end justify-between mb-5 gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#38bdf8]/40">
              VIRTUAL DCA · 1年前スタート
            </p>
            <h2 className="mt-0.5 text-base font-semibold tracking-tight text-[#e8f4ff]">
              積立パターン比較
            </h2>
            <p className="mt-0.5 text-[11px] text-slate-500">
              1年前から月3万で積み立てた場合の今日時点リターン
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[9px] text-slate-600">{months}ヶ月 · 毎日更新</span>
            <Link
              href="/simulate"
              className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-3 py-1.5 font-mono text-[10px] text-amber-400 hover:bg-amber-400/[0.08] transition-all"
            >
              詳細試算 →
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {patterns.map(({ pattern, result }) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              result={result}
              isVoo={pattern.id === "sp500"}
            />
          ))}
        </div>

        <p className="mt-4 font-mono text-[9px] text-slate-600">
          ※ Yahoo Finance 月次終値でDCA計算、当日価格で時価評価。シグナル型はBUY月のみ投資・それ以外は現金保持。日本株は円建て。過去実績は将来を保証しません。
        </p>
      </div>
    </section>
  );
}
