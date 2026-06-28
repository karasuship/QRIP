"use client";

import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { TrendItem, QuarterlyItem, StockCalendar, ChartData, PeerStats, AnalystData, ShortData } from "./page";
import type { Headline } from "@/lib/news-fetch";

interface Stock {
  code: string; name: string; market: string; sector: string;
  price: number | null;
  pbr: number | null; per: number | null;
  roe: number | null; roa: number | null;
  equity_ratio: number | null; operating_margin: number | null;
  dividend_yield: number | null; revenue_growth_yoy: number | null;
  net_sales: number | null; operating_profit: number | null;
  total_assets: number | null; equity: number | null;
  week52_high?: number | null; week52_low?: number | null;
  margin_buy?: number | null; margin_sell?: number | null;
  margin_ratio?: number | null; margin_date?: string | null;
  growth_flag: string | null; value_flag: string | null;
}

const VALUE_CLS: Record<string, string> = {
  "優良バリュー": "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30",
  "急成長警戒":   "bg-amber-400/15 text-amber-400 border-amber-400/30",
  "低収益放置":   "bg-[#f87171]/15 text-[#f87171] border-[#f87171]/30",
  "高収益割安":   "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/30",
};

const TT = {
  contentStyle: { background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", color: "#e8f4ff", fontSize: 11 },
  labelStyle: { color: "#94a3b8" },
};

function pct(v: number | null, d = 1) { return v == null ? "—" : (v * 100).toFixed(d) + "%"; }
function oku(v: number | null) {
  if (v == null) return "—";
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + "兆円";
  return v.toLocaleString() + "億円";
}
function chg(v: number | null) {
  if (v == null) return null;
  const s = (v * 100).toFixed(1);
  return { text: (v >= 0 ? "+" : "") + s + "%", pos: v >= 0 };
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

export default function StockDetail({
  stock, trend, quarterly, calendar, chartData, peerStats, analystData, tickerNews,
}: {
  stock: Stock;
  trend: TrendItem[];
  quarterly: QuarterlyItem[];
  calendar: StockCalendar;
  chartData: ChartData;
  peerStats?: PeerStats | null;
  analystData?: AnalystData | null;
  tickerNews?: Headline[];
}) {
  const code4 = stock.code.slice(0, 4);
  const tvSrc = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(`TSE:${code4}`)}&interval=W&theme=Dark&style=1&locale=ja&timezone=Asia%2FTokyo&hide_side_toolbar=0`;

  const earningsDays = daysUntil(calendar.nextEarningsDate);
  const earningsAlert = earningsDays != null && earningsDays >= 0 && earningsDays <= 21;

  const hasRange = stock.price != null && stock.week52_high != null && stock.week52_low != null
    && stock.week52_high > stock.week52_low;
  const rangePct = hasRange
    ? Math.min(100, Math.max(0, (stock.price! - stock.week52_low!) / (stock.week52_high! - stock.week52_low!) * 100))
    : null;

  const c1m = chg(chartData.change1m);
  const c3m = chg(chartData.change3m);
  const c1y = chg(chartData.change1y);
  const hasChange = c1m || c3m || c1y;

  const hasEvents = calendar.nextEarningsDate || calendar.exDivDate || calendar.divDate;

  const METRICS = [
    { label: "ROE",       value: pct(stock.roe),                note: "自己資本利益率" },
    { label: "ROA",       value: pct(stock.roa),                note: "総資産利益率" },
    { label: "自己資本比率", value: pct(stock.equity_ratio, 0),  note: "財務健全性" },
    { label: "営業利益率", value: pct(stock.operating_margin),   note: "稼ぐ力" },
    { label: "売上成長率", value: pct(stock.revenue_growth_yoy), note: "前期比" },
    { label: "売上高",    value: oku(stock.net_sales      != null ? Math.round(stock.net_sales      / 1e8) : null), note: "直近通期" },
    { label: "営業利益",  value: oku(stock.operating_profit != null ? Math.round(stock.operating_profit / 1e8) : null), note: "直近通期" },
    { label: "総資産",    value: oku(stock.total_assets    != null ? Math.round(stock.total_assets    / 1e8) : null), note: "直近通期" },
  ];

  const IR_LINKS = [
    { label: "irbank",       url: `https://irbank.net/${code4}` },
    { label: "TDnet",        url: `https://www.release.tdnet.info/inbs/I_main_00.html` },
    { label: "kabutan",      url: `https://kabutan.jp/stock/?code=${code4}` },
    { label: "Yahoo Finance",url: `https://finance.yahoo.co.jp/quote/${code4}.T` },
    { label: "EDINET",       url: `https://disclosure.edinet-api.go.jp/` },
  ];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">

        {/* 戻るリンク */}
        <Link href="/screener" className="font-mono text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
          ← スクリーナーに戻る
        </Link>

        {/* ヘッダー */}
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{stock.code} / {stock.market}</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#e8f4ff] truncate">{stock.name}</h1>
            <p className="mt-0.5 font-mono text-[10px] text-slate-500">{stock.sector}</p>
          </div>
          <div className="flex items-center gap-3">
            {stock.price != null && (
              <span className="font-mono text-xl font-semibold text-[#e8f4ff]">¥{stock.price.toLocaleString()}</span>
            )}
            {stock.value_flag && (
              <span className={`rounded-full border px-3 py-1 font-mono text-xs ${VALUE_CLS[stock.value_flag] ?? "text-slate-500"}`}>
                {stock.value_flag}
              </span>
            )}
          </div>
        </div>

        {/* 関連ニュース（自動取得） */}
        {tickerNews && tickerNews.length > 0 && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.04] px-5 py-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-3">関連ニュース</p>
            <ul className="space-y-2">
              {tickerNews.map((n, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="font-mono text-[9px] text-slate-600 shrink-0 mt-0.5 w-4">{i + 1}.</span>
                  <div className="min-w-0">
                    <p className="text-[11px] leading-5 text-slate-300 line-clamp-2">{n.title}</p>
                    <p className="font-mono text-[9px] text-slate-600 mt-0.5">{n.source}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 font-mono text-[9px] text-slate-600">Yahoo Finance より自動取得 · 英語原文</p>
          </div>
        )}

        {/* 相場位置 + 騰落率 */}
        {(hasRange || hasChange) && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">相場位置</p>

            {hasChange && (
              <div className="flex gap-6 mb-5">
                {[{ label: "1ヶ月", c: c1m }, { label: "3ヶ月", c: c3m }, { label: "1年", c: c1y }].map(({ label, c }) =>
                  c ? (
                    <div key={label} className="text-center">
                      <p className="font-mono text-[9px] text-slate-500">{label}</p>
                      <p className={`font-mono text-base font-semibold ${c.pos ? "text-[#34d399]" : "text-[#f87171]"}`}>
                        {c.text}
                      </p>
                    </div>
                  ) : null
                )}
              </div>
            )}

            {hasRange && (
              <div>
                <div className="flex justify-between font-mono text-[9px] text-slate-500 mb-2">
                  <span>52週安値  ¥{stock.week52_low!.toLocaleString()}</span>
                  <span className="text-slate-500">{rangePct!.toFixed(0)}% 位置</span>
                  <span>52週高値  ¥{stock.week52_high!.toLocaleString()}</span>
                </div>
                <div className="relative h-2 w-full rounded-full bg-white/[0.14]">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-[#38bdf8]/40"
                    style={{ width: `${rangePct}%` }}
                  />
                  <div
                    className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full border-2 border-[#020c1b] bg-[#38bdf8]"
                    style={{ left: `${Math.min(97, Math.max(3, rangePct!))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 決算警告バナー */}
        {earningsAlert && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-3">
            <span className="font-mono text-[10px] font-semibold text-amber-400">
              ⚠ 決算発表まで {earningsDays}日
            </span>
            <span className="font-mono text-[9px] text-amber-600">{calendar.nextEarningsDate}</span>
            <span className="font-mono text-[9px] text-amber-700 ml-auto">決算前後は急変動リスクあり</span>
          </div>
        )}

        {/* TradingView チャート */}
        <div className="rounded-2xl border border-white/[0.18] overflow-hidden bg-white/[0.02]">
          <p className="px-4 pt-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">株価チャート（週足）</p>
          <iframe src={tvSrc} className="w-full" style={{ height: 400, display: "block" }} allowFullScreen />
        </div>

        {/* コーポレートイベント */}
        {hasEvents && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">コーポレートイベント</p>
            <div className="flex flex-wrap gap-6">
              {calendar.nextEarningsDate && (
                <div>
                  <p className="font-mono text-[9px] text-slate-500">次回決算</p>
                  <p className="font-mono text-sm text-[#38bdf8] mt-0.5">{calendar.nextEarningsDate}</p>
                </div>
              )}
              {calendar.exDivDate && (
                <div>
                  <p className="font-mono text-[9px] text-slate-500">権利落日</p>
                  <p className="font-mono text-sm text-amber-400 mt-0.5">{calendar.exDivDate}</p>
                </div>
              )}
              {calendar.divDate && (
                <div>
                  <p className="font-mono text-[9px] text-slate-500">配当支払</p>
                  <p className="font-mono text-sm text-slate-300 mt-0.5">{calendar.divDate}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 財務指標グリッド */}
        <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">財務指標（直近通期）</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRICS.map(({ label, value, note }) => (
              <div key={label} className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-3">
                <p className="font-mono text-[9px] text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-[#e8f4ff]">{value}</p>
                <p className="font-mono text-[8px] text-slate-500">{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 業種内ランク */}
        {peerStats && peerStats.ranks.length > 0 && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <div className="flex items-baseline justify-between mb-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">業種内ランク</p>
              <p className="font-mono text-[9px] text-slate-500">{peerStats.sector} / {peerStats.sectorCount}銘柄中</p>
            </div>
            <div className="space-y-3">
              {peerStats.ranks.map(({ label, value, rank }) => {
                const topPct = Math.round(100 - rank);
                const rankCls = rank >= 75 ? "text-[#34d399]" : rank >= 50 ? "text-[#38bdf8]" : rank >= 25 ? "text-slate-400" : "text-[#f87171]";
                const barCls  = rank >= 75 ? "bg-[#34d399]/50" : rank >= 50 ? "bg-[#38bdf8]/50" : rank >= 25 ? "bg-slate-500/40" : "bg-[#f87171]/50";
                return (
                  <div key={label} className="flex items-center gap-3">
                    <p className="font-mono text-[9px] text-slate-500 w-20 shrink-0">{label}</p>
                    <div className="flex-1 h-1.5 rounded-full bg-white/[0.13]">
                      <div className={`h-full rounded-full transition-all ${barCls}`} style={{ width: `${rank}%` }} />
                    </div>
                    <span className={`font-mono text-[10px] font-semibold ${rankCls} w-14 text-right shrink-0`}>上位{topPct}%</span>
                    <span className="font-mono text-[9px] text-slate-500 w-12 text-right shrink-0">{value}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-3 font-mono text-[8px] text-slate-500">PBR割安度は低いほど割安（上位=割安）</p>
          </div>
        )}

        {/* アナリスト推奨 */}
        {analystData?.recommendation && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">
              アナリスト推奨（最新 / {analystData.recommendation.total}人）
            </p>
            {(() => {
              const r = analystData.recommendation!;
              const segs = [
                { key: "strongBuy",   val: r.strongBuy,   label: "強買", cls: "bg-[#34d399]" },
                { key: "buy",         val: r.buy,         label: "買い", cls: "bg-[#86efac]" },
                { key: "hold",        val: r.hold,        label: "中立", cls: "bg-slate-500" },
                { key: "sell",        val: r.sell,        label: "売り", cls: "bg-[#fca5a5]" },
                { key: "strongSell",  val: r.strongSell,  label: "強売", cls: "bg-[#f87171]" },
              ];
              return (
                <>
                  <div className="flex h-3 w-full rounded-full overflow-hidden gap-px mb-3">
                    {segs.map(({ key, val, cls }) =>
                      val > 0 ? (
                        <div key={key} className={`${cls}`} style={{ width: `${(val / r.total) * 100}%` }} />
                      ) : null
                    )}
                  </div>
                  <div className="flex gap-4">
                    {segs.filter((s) => s.val > 0).map(({ key, val, label, cls }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${cls}`} />
                        <span className="font-mono text-[9px] text-slate-500">{label}</span>
                        <span className="font-mono text-[10px] font-semibold text-slate-300">{val}</span>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>
        )}

        {/* 機関投資家・インサイダー保有比率 */}
        {analystData?.holders && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">保有者構成</p>
            {(() => {
              const h = analystData.holders!;
              const rows = [
                { label: "機関投資家", pct: h.institutionsPct, sub: h.institutionsCount ? `${h.institutionsCount}機関` : null, cls: "bg-[#38bdf8]/50" },
                { label: "インサイダー", pct: h.insidersPct, sub: null, cls: "bg-amber-400/50" },
              ].filter((r) => r.pct != null);
              return (
                <div className="space-y-3">
                  {rows.map(({ label, pct, sub, cls }) => (
                    <div key={label} className="flex items-center gap-3">
                      <p className="font-mono text-[9px] text-slate-500 w-24 shrink-0">{label}</p>
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.13]">
                        <div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.min(100, pct! * 100)}%` }} />
                      </div>
                      <span className="font-mono text-[10px] font-semibold text-slate-300 w-12 text-right shrink-0">
                        {(pct! * 100).toFixed(1)}%
                      </span>
                      {sub && <span className="font-mono text-[9px] text-slate-500 shrink-0">{sub}</span>}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 空売り残高 */}
        {analystData?.short && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">空売り残高（Yahoo Finance）</p>
            {(() => {
              const s = analystData.short!;
              const items = [
                { label: "空売り残高（株数）", value: s.sharesShort != null ? s.sharesShort.toLocaleString() + "株" : "—" },
                { label: "先月比",            value: s.sharesShortPriorMonth != null && s.sharesShort != null
                  ? ((s.sharesShort - s.sharesShortPriorMonth) / s.sharesShortPriorMonth >= 0 ? "+" : "") +
                    ((s.sharesShort - s.sharesShortPriorMonth) / s.sharesShortPriorMonth * 100).toFixed(1) + "%" : "—" },
                { label: "空売り比率（float）", value: s.shortPercentOfFloat != null ? (s.shortPercentOfFloat * 100).toFixed(1) + "%" : "—" },
                { label: "返済日数（日）",      value: s.shortRatio != null ? s.shortRatio.toFixed(1) + "日" : "—" },
              ];
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {items.map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-3">
                      <p className="font-mono text-[9px] text-slate-500">{label}</p>
                      <p className="mt-1 font-mono text-sm font-semibold text-[#e8f4ff]">{value}</p>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* 信用取引残高 */}
        {stock.margin_buy != null && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <div className="flex items-baseline justify-between mb-4">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">信用取引残高</p>
              {stock.margin_date && (
                <p className="font-mono text-[9px] text-slate-500">{stock.margin_date} 時点</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-3">
                <p className="font-mono text-[9px] text-slate-500">信用買い残</p>
                <p className="mt-1 font-mono text-sm font-semibold text-[#38bdf8]">
                  {stock.margin_buy!.toLocaleString()}株
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-3">
                <p className="font-mono text-[9px] text-slate-500">信用売り残</p>
                <p className="mt-1 font-mono text-sm font-semibold text-[#f87171]">
                  {stock.margin_sell != null ? stock.margin_sell.toLocaleString() + "株" : "—"}
                </p>
              </div>
              <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-3">
                <p className="font-mono text-[9px] text-slate-500">信用倍率（買/売）</p>
                <p className="mt-1 font-mono text-sm font-semibold text-[#e8f4ff]">
                  {stock.margin_ratio != null ? stock.margin_ratio.toFixed(2) + "倍" : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 四半期業績推移 */}
        {quarterly.length > 1 && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">四半期業績推移（億円・累計）</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={quarterly} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={50} />
                <Tooltip {...TT} />
                <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                <Bar dataKey="salesOku" fill="#38bdf8" name="売上高" radius={[3, 3, 0, 0]} />
                <Bar dataKey="opOku"    fill="#34d399" name="営業利益" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 通期業績推移 */}
        {trend.length > 1 && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">売上高・営業利益推移（億円・通期）</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={50} />
                  <Tooltip {...TT} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                  <Bar dataKey="salesOku" fill="#38bdf8" name="売上高" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opOku"    fill="#34d399" name="営業利益" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {trend.some((t) => t.equityRatioPct !== null) && (
              <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">自己資本比率推移（%）</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} width={35} />
                    <Tooltip {...TT} formatter={(v) => [`${v}%`, "自己資本比率"]} />
                    <Line dataKey="equityRatioPct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: "#f59e0b" }} name="自己資本比率" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* 配当履歴 */}
        {chartData.dividends.length > 0 && (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">配当履歴（円/株）</p>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={chartData.dividends.slice(-10)} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 9 }} tickFormatter={(d: string) => d.slice(0, 7)} />
                <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={35} />
                <Tooltip {...TT} formatter={(v) => [`¥${v}`, "配当"]} />
                <Bar dataKey="amount" fill="#f59e0b" name="配当" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* 外部リンク */}
        <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-3">外部リンク</p>
          <div className="flex flex-wrap gap-2">
            {IR_LINKS.map(({ label, url }) => (
              <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                className="rounded-lg border border-white/[0.18] bg-white/[0.14] px-3 py-1.5 font-mono text-[10px] text-slate-400 hover:bg-white/[0.14] hover:text-slate-200 transition-all">
                {label} ↗
              </a>
            ))}
          </div>
        </div>

        {/* シミュレーション連携 */}
        {stock.dividend_yield != null && stock.dividend_yield > 0 && (
          <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] p-4">
            <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">30年試算</p>
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-medium text-slate-300">
                  {stock.name} の配当利回り{" "}
                  <span className="font-mono font-bold text-[#34d399]">
                    {(stock.dividend_yield * 100).toFixed(2)}%
                  </span>{" "}
                  で長期積立を試算
                </p>
                <p className="mt-0.5 font-mono text-[10px] text-slate-500">
                  月積立・NISA・取り崩し設定は試算ページで自由に変更できます
                </p>
              </div>
              <Link
                href={`/simulate?stock=${encodeURIComponent(stock.name)}&yield=${(stock.dividend_yield * 100).toFixed(1)}`}
                className="shrink-0 rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.08] px-4 py-2 font-mono text-xs text-[#38bdf8] transition-colors hover:bg-[#38bdf8]/[0.14]"
              >
                30年試算を開く →
              </Link>
            </div>
          </div>
        )}

        <p className="font-mono text-[9px] text-slate-500">
          データ: J-Quants（財務）/ Yahoo Finance（株価・配当）/ TradingView（チャート）。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
