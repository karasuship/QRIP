"use client";

import Link from "next/link";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { TrendItem } from "./page";

interface Stock {
  code: string;
  name: string;
  market: string;
  sector: string;
  price: number | null;
  pbr: number | null;
  per: number | null;
  roe: number | null;
  roa: number | null;
  equity_ratio: number | null;
  operating_margin: number | null;
  dividend_yield: number | null;
  revenue_growth_yoy: number | null;
  net_sales: number | null;
  operating_profit: number | null;
  total_assets: number | null;
  equity: number | null;
  growth_flag: string | null;
  value_flag: string | null;
}

const VALUE_CLS: Record<string, string> = {
  "優良バリュー":   "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30",
  "急成長警戒":     "bg-amber-400/15 text-amber-400 border-amber-400/30",
  "低収益放置":     "bg-[#f87171]/15 text-[#f87171] border-[#f87171]/30",
  "高収益割安":     "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/30",
};

function pct(v: number | null, d = 1) { return v == null ? "—" : (v * 100).toFixed(d) + "%"; }
function oku(v: number | null) {
  if (v == null) return "—";
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(1) + "兆円";
  return v.toLocaleString() + "億円";
}

const TOOLTIP_STYLE = {
  contentStyle: { background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", color: "#e8f4ff", fontSize: 11 },
  labelStyle: { color: "#94a3b8" },
};

export default function StockDetail({ stock, trend }: { stock: Stock; trend: TrendItem[] }) {
  const code4 = stock.code.slice(0, 4);
  const tvSymbol = `TSE:${code4}`;
  const tvSrc = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=W&theme=Dark&style=1&locale=ja&timezone=Asia%2FTokyo&hide_side_toolbar=0`;

  const METRICS = [
    { label: "ROE",       value: pct(stock.roe),              note: "自己資本利益率" },
    { label: "ROA",       value: pct(stock.roa),              note: "総資産利益率" },
    { label: "自己資本比率", value: pct(stock.equity_ratio, 0), note: "財務健全性" },
    { label: "営業利益率", value: pct(stock.operating_margin), note: "稼ぐ力" },
    { label: "売上成長率", value: pct(stock.revenue_growth_yoy), note: "前期比" },
    { label: "売上高",    value: oku(stock.net_sales != null ? Math.round(stock.net_sales / 1e8) : null), note: "直近通期" },
    { label: "営業利益",  value: oku(stock.operating_profit != null ? Math.round(stock.operating_profit / 1e8) : null), note: "直近通期" },
    { label: "総資産",    value: oku(stock.total_assets != null ? Math.round(stock.total_assets / 1e8) : null), note: "直近通期" },
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
          {stock.value_flag && (
            <span className={`rounded-full border px-3 py-1 font-mono text-xs ${VALUE_CLS[stock.value_flag] ?? "text-slate-500"}`}>
              {stock.value_flag}
            </span>
          )}
        </div>

        {/* TradingView チャート */}
        <div className="rounded-2xl border border-white/[0.10] overflow-hidden bg-white/[0.02]">
          <p className="px-4 pt-3 font-mono text-[9px] uppercase tracking-widest text-slate-600">株価チャート（TradingView）</p>
          <iframe
            src={tvSrc}
            className="w-full"
            style={{ height: 400, display: "block" }}
            allowFullScreen
          />
        </div>

        {/* 指標グリッド */}
        <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">財務指標（直近通期）</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {METRICS.map(({ label, value, note }) => (
              <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-3">
                <p className="font-mono text-[9px] text-slate-500">{label}</p>
                <p className="mt-1 font-mono text-lg font-semibold text-[#e8f4ff]">{value}</p>
                <p className="font-mono text-[8px] text-slate-700">{note}</p>
              </div>
            ))}
          </div>
        </div>

        {/* 財務推移チャート */}
        {trend.length > 1 && (
          <div className="space-y-4">
            {/* 売上・営業利益 */}
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">売上高・営業利益推移（億円）</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 10 }} width={50} />
                  <Tooltip {...TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: 10, color: "#64748b" }} />
                  <Bar dataKey="salesOku" fill="#38bdf8" name="売上高" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="opOku" fill="#34d399" name="営業利益" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 自己資本比率 */}
            {trend.some((t) => t.equityRatioPct !== null) && (
              <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-4">自己資本比率推移（%）</p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={trend} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="year" tick={{ fill: "#64748b", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} width={35} />
                    <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, "自己資本比率"]} />
                    <Line
                      dataKey="equityRatioPct"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={{ r: 3, fill: "#f59e0b" }}
                      name="自己資本比率"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        <p className="font-mono text-[9px] text-slate-700">
          データ: J-Quants API（財務）/ TradingView（株価）。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
