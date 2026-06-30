import Link from "next/link";
import { PORTFOLIO_PATTERNS, backtestAllPatterns, BacktestResult, PatternDef } from "@/lib/portfolio-backtest";
import { PortfolioChart, ChartSeries } from "@/app/components/PortfolioChart";

function fmtPct(n: number, forceSign = false) {
  return `${forceSign && n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

// ── コンパクトな結果バー ──────────────────────────────────────────────────────
function ResultRow({
  pattern,
  result,
  isBaseline,
}: {
  pattern: PatternDef;
  result: BacktestResult;
  isBaseline: boolean;
}) {
  const isSignal = pattern.backtestMode === "jp_signal";

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-xl border px-4 py-3 ${
        isBaseline
          ? "border-white/[0.10] bg-white/[0.02]"
          : isSignal
          ? "border-[#34d399]/20 bg-[#34d399]/[0.04]"
          : "border-white/[0.15] bg-white/[0.05]"
      }`}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isBaseline && (
          <span className="shrink-0 rounded border border-white/[0.18] bg-white/[0.08] px-1.5 py-0.5 font-mono text-[8px] text-slate-500">
            脳死積立
          </span>
        )}
        {isSignal && (
          <span className="shrink-0 rounded border border-[#34d399]/30 bg-[#34d399]/[0.08] px-1.5 py-0.5 font-mono text-[8px] text-[#34d399]">
            QRIP検証済み
          </span>
        )}
        <p className="font-mono text-xs text-slate-300 truncate">{pattern.name}</p>
        {isSignal && result.activatedMonths !== undefined && (
          <span className="font-mono text-[9px] text-slate-600 shrink-0">
            発動{result.activatedMonths}/{result.months}ヶ月
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <div className="text-right">
          <p className="font-mono text-[9px] text-slate-500">リターン</p>
          <p className={`font-mono text-sm font-bold tabular-nums ${result.returnPct >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
            {fmtPct(result.returnPct, true)}
          </p>
        </div>
        {!isBaseline && (
          <div className="text-right">
            <p className="font-mono text-[9px] text-slate-500">vs 基準</p>
            <p className={`font-mono text-sm font-bold tabular-nums ${result.vsVoo >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
              {fmtPct(result.vsVoo, true)}
            </p>
          </div>
        )}
      </div>
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

      {/* 結果リスト */}
      <div className="space-y-2">
        {rows.map(({ pattern, result, isBaseline }) => (
          <ResultRow
            key={pattern.id}
            pattern={pattern}
            result={result}
            isBaseline={isBaseline}
          />
        ))}
      </div>

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
