import Link from "next/link";
import { PORTFOLIO_PATTERNS, backtestAllPatterns, BacktestResult, PatternDef } from "@/lib/portfolio-backtest";
import { PortfolioChart, ChartSeries } from "@/app/components/PortfolioChart";

function fmtPct(n: number, forceSign = false) {
  return `${forceSign && n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── 利回りテーブル ────────────────────────────────────────────────────────────
function YieldTable({
  rows,
}: {
  rows: { pattern: PatternDef; result: BacktestResult; isBaseline: boolean }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.15]">
      {/* ヘッダー行 */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 border-b border-white/[0.12] bg-white/[0.04] px-4 py-2">
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">パターン</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 text-right">年換算</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 text-right">通算</p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 text-right">vs 基準</p>
      </div>

      {/* データ行 */}
      {rows.map(({ pattern, result, isBaseline }, i) => {
        const isSignal = pattern.backtestMode === "jp_signal";
        const isLast   = i === rows.length - 1;
        return (
          <div
            key={pattern.id}
            className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 items-center px-4 py-3 ${
              !isLast ? "border-b border-white/[0.08]" : ""
            } ${isSignal ? "bg-[#34d399]/[0.03]" : isBaseline ? "" : "bg-white/[0.02]"}`}
          >
            {/* パターン名 */}
            <div className="flex items-center gap-2 min-w-0">
              {isBaseline && (
                <span className="shrink-0 rounded border border-white/[0.15] bg-white/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-slate-500">
                  基準
                </span>
              )}
              {isSignal && (
                <span className="shrink-0 rounded border border-[#34d399]/30 bg-[#34d399]/[0.08] px-1.5 py-0.5 font-mono text-[8px] text-[#34d399]">
                  ★QRIP
                </span>
              )}
              <span className="font-mono text-xs text-slate-300 truncate">{pattern.name}</span>
              {isSignal && result.activatedMonths !== undefined && (
                <span className="hidden sm:inline font-mono text-[9px] text-slate-600 shrink-0">
                  発動{result.activatedMonths}/{result.months}ヶ月
                </span>
              )}
            </div>

            {/* 年換算 */}
            <p className={`font-mono text-sm font-bold tabular-nums text-right ${
              result.annualizedReturn >= 0 ? "text-[#34d399]" : "text-[#f87171]"
            }`}>
              {fmtPct(result.annualizedReturn, true)}
            </p>

            {/* 通算 */}
            <p className={`font-mono text-sm font-bold tabular-nums text-right ${
              result.returnPct >= 0 ? "text-[#34d399]" : "text-[#f87171]"
            }`}>
              {fmtPct(result.returnPct, true)}
            </p>

            {/* vs 基準 */}
            <p className={`font-mono text-sm tabular-nums text-right ${
              isBaseline
                ? "text-slate-600"
                : result.vsVoo > 0
                ? "text-[#34d399] font-bold"
                : result.vsVoo < 0
                ? "text-[#f87171] font-bold"
                : "text-slate-500"
            }`}>
              {isBaseline ? "—" : fmtPct(result.vsVoo, true)}
            </p>
          </div>
        );
      })}
    </div>
  );
}


// ── 各セクション ──────────────────────────────────────────────────────────────
function PatternSection({
  badge,
  title,
  description,
  chartSeries,
  rows,
  note,
}: {
  badge: string;
  title: string;
  description: string;
  chartSeries: ChartSeries[];
  rows: { pattern: PatternDef; result: BacktestResult; isBaseline: boolean }[];
  note?: string;
}) {
  return (
    <div className="py-8 border-b border-white/[0.10] last:border-b-0">
      {/* ヘッダー */}
      <div className="mb-4">
        <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#38bdf8]/40">{badge}</span>
        <h3 className="mt-0.5 text-base font-semibold tracking-tight text-[#e8f4ff]">{title}</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
      </div>

      {/* チャート */}
      <div className="rounded-2xl border border-white/[0.10] bg-[#020c1b]/60 px-2 pt-3 pb-1 mb-4 overflow-hidden">
        <PortfolioChart series={chartSeries} height={300} />
      </div>

      {/* 利回りテーブル */}
      <YieldTable rows={rows} />

      {note && (
        <p className="mt-3 font-mono text-[9px] text-slate-600">{note}</p>
      )}
    </div>
  );
}

// ── メイン ────────────────────────────────────────────────────────────────────
export default async function PortfolioPatterns() {
  let resultsMap: Map<string, BacktestResult>;
  try {
    resultsMap = await backtestAllPatterns();
  } catch {
    return null;
  }

  const get = (id: string) => resultsMap.get(id);

  // ETF グループ（sp500 を脳死積立ベースに）
  const etfIds    = ["sp500", "growth", "balance", "world"];
  const etfVsBase = (id: string) => {
    const r = get(id);
    const base = get("sp500");
    if (!r?.ok || !base?.ok) return r;
    return { ...r, vsVoo: r.returnPct - base.returnPct };
  };

  const etfRows = etfIds
    .map((id) => {
      const pattern = PORTFOLIO_PATTERNS.find((p) => p.id === id);
      const result  = get(id);
      if (!pattern || !result?.ok) return null;
      return { pattern, result: { ...result, vsVoo: etfVsBase(id)?.vsVoo ?? 0 }, isBaseline: id === "sp500" };
    })
    .filter(Boolean) as { pattern: PatternDef; result: BacktestResult; isBaseline: boolean }[];

  const etfChart: ChartSeries[] = etfRows.map(({ pattern, result, isBaseline }) => ({
    id: pattern.id,
    snapshots: result.snapshots,
    isBaseline,
  }));

  // 配当グループ（jp_blind を脳死積立ベース、sp500 を参考線）
  const divIds = ["jp_blind", "jp_signal", "sp500"];

  const divRows = divIds
    .map((id) => {
      const pattern = PORTFOLIO_PATTERNS.find((p) => p.id === id);
      const result  = get(id);
      if (!pattern || !result?.ok) return null;
      const blindResult = get("jp_blind");
      const vsBase = blindResult?.ok ? result.returnPct - blindResult.returnPct : 0;
      return {
        pattern,
        result: { ...result, vsVoo: vsBase },
        isBaseline: id === "jp_blind",
      };
    })
    .filter(Boolean) as { pattern: PatternDef; result: BacktestResult; isBaseline: boolean }[];

  const divChart: ChartSeries[] = divRows.map(({ pattern, result, isBaseline }) => ({
    id: pattern.id,
    snapshots: result.snapshots,
    isBaseline,
  }));

  const months = get("sp500")?.months ?? 12;

  if (etfRows.length === 0 && divRows.length === 0) return null;

  return (
    <section className="border-b border-white/[0.15]">
      <div className="mx-auto max-w-4xl px-6">

        {/* セクションタイトル */}
        <div className="flex items-center justify-between pt-8 pb-2 gap-3 flex-wrap">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#38bdf8]/40">
              VIRTUAL DCA · 1年前スタート · {months}ヶ月
            </p>
            <h2 className="mt-0.5 text-lg font-semibold tracking-tight text-[#e8f4ff]">
              積立戦略比較
            </h2>
          </div>
          <Link
            href="/simulate"
            className="shrink-0 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] px-3 py-1.5 font-mono text-[10px] text-amber-400 hover:bg-amber-400/[0.08] transition-all"
          >
            詳細試算 →
          </Link>
        </div>

        {/* ETFセクション */}
        {etfRows.length >= 2 && (
          <PatternSection
            badge="ETF戦略比較"
            title="毎月VOOを買い続けるだけで良いのか"
            description="全米インデックス（脳死積立）を基準に、異なるETF配分が結果にどう影響するか"
            chartSeries={etfChart}
            rows={etfRows}
            note="※ Yahoo Finance 月次終値でDCA計算、当日価格で時価評価。過去実績は将来を保証しません。"
          />
        )}

        {/* 配当シグナルセクション */}
        {divRows.length >= 2 && (
          <PatternSection
            badge="配当シグナル比較"
            title="シグナルを無視して毎月買うより、BUYを待つ方が良いか"
            description="NTT/JT/KDDIを均等積立（脳死）と、利回りシグナル連動の差。decisions/0033"
            chartSeries={divChart}
            rows={divRows}
            note="※ シグナル型はBUY月のみ投資・それ以外は現金保持。日本株は円建てのため全米との直接比較は参考値。"
          />
        )}

      </div>
    </section>
  );
}
