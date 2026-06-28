"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

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
  growth_flag: string | null;
  value_flag: string | null;
}

const VALUE_FLAG_CLS: Record<string, string> = {
  "優良バリュー":   "bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30",
  "急成長警戒":     "bg-amber-400/15 text-amber-400 border-amber-400/30",
  "低収益放置":     "bg-[#f87171]/15 text-[#f87171] border-[#f87171]/30",
  "高収益割安":     "bg-[#38bdf8]/15 text-[#38bdf8] border-[#38bdf8]/30",
};

const GROWTH_FLAG_CLS: Record<string, string> = {
  "急成長（要注意）": "text-amber-400",
  "安定成長":         "text-[#34d399]",
  "横ばい":           "text-slate-400",
  "縮小中":           "text-[#f87171]",
};

function pct(v: number | null, digits = 1): string {
  if (v == null) return "—";
  return (v * 100).toFixed(digits) + "%";
}
function num(v: number | null, digits = 2): string {
  if (v == null) return "—";
  return v.toFixed(digits);
}

// スライダーが「最大緩い値」のときはフィルター未適用（制限なし）
const INACTIVE = {
  pbr_max: 3,        // 3倍 = 制限なし
  per_max: 50,       // 50倍 = 制限なし
  equity_ratio_min: 0,
  dividend_yield_min: 0,
  roe_min: 0,
  roa_min: 0,
  operating_margin_min: 0,
  revenue_growth_max: 50, // 50% = 制限なし
};

const DEFAULT_FILTERS = {
  pbr_max: 3,          // 初期 = 制限なし
  per_max: 50,         // 初期 = 制限なし
  equity_ratio_min: 0,
  dividend_yield_min: 0,
  roe_min: 0,
  roa_min: 0,
  operating_margin_min: 0,
  revenue_growth_max: 50,
  market: "全て",
  value_flag: "全て",
};

const MARKETS = ["全て", "プライム", "スタンダード", "グロース"];
const VALUE_FLAGS = ["全て", "優良バリュー", "急成長警戒", "低収益放置", "高収益割安"];

export default function ScreenerClient({ totalCount }: { totalCount: number }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const search = useCallback(async () => {
    setLoading(true);

    const params = new URLSearchParams();
    if (filters.pbr_max < INACTIVE.pbr_max)                        params.set("pbr_max",             String(filters.pbr_max));
    if (filters.per_max < INACTIVE.per_max)                        params.set("per_max",             String(filters.per_max));
    if (filters.equity_ratio_min > 0)                              params.set("equity_ratio_min",    String(filters.equity_ratio_min));
    if (filters.dividend_yield_min > 0)                            params.set("dividend_yield_min",  String(filters.dividend_yield_min));
    if (filters.roe_min > 0)                                       params.set("roe_min",             String(filters.roe_min));
    if (filters.roa_min > 0)                                       params.set("roa_min",             String(filters.roa_min));
    if (filters.operating_margin_min > 0)                          params.set("operating_margin_min",String(filters.operating_margin_min));
    if (filters.revenue_growth_max < INACTIVE.revenue_growth_max)  params.set("revenue_growth_max",  String(filters.revenue_growth_max));
    if (filters.market !== "全て")                                  params.set("market",              filters.market);
    if (filters.value_flag !== "全て")                              params.set("value_flag",          filters.value_flag);

    const res = await fetch(`/api/screener/search?${params}`);
    if (res.ok) {
      const json = await res.json();
      setResults(json.data as Stock[]);
      setCount(json.data.length);
    }
    setLoading(false);
  }, [filters]);

  useEffect(() => { search(); }, [search]);

  function setF<K extends keyof typeof DEFAULT_FILTERS>(key: K, val: (typeof DEFAULT_FILTERS)[K]) {
    setFilters((f) => ({ ...f, [key]: val }));
  }

  return (
    <div>
      {/* ── フィルター ── */}
      <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 mb-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          <FilterSlider label="PBR 以下" unit="倍" value={filters.pbr_max} min={0.1} max={3} step={0.1}
            inactive={filters.pbr_max >= INACTIVE.pbr_max}
            onChange={(v) => setF("pbr_max", v)} />
          <FilterSlider label="PER 以下" unit="倍" value={filters.per_max} min={1} max={50} step={1}
            inactive={filters.per_max >= INACTIVE.per_max}
            onChange={(v) => setF("per_max", v)} />
          <FilterSlider label="自己資本比率 以上" unit="%" value={filters.equity_ratio_min} min={0} max={90} step={5}
            inactive={filters.equity_ratio_min <= 0}
            onChange={(v) => setF("equity_ratio_min", v)} />
          <FilterSlider label="配当利回り 以上" unit="%" value={filters.dividend_yield_min} min={0} max={8} step={0.5}
            inactive={filters.dividend_yield_min <= 0}
            onChange={(v) => setF("dividend_yield_min", v)} />
          <FilterSlider label="ROE 以上" unit="%" value={filters.roe_min} min={0} max={30} step={1}
            inactive={filters.roe_min <= 0}
            onChange={(v) => setF("roe_min", v)} />
          <FilterSlider label="ROA 以上" unit="%" value={filters.roa_min} min={0} max={20} step={1}
            inactive={filters.roa_min <= 0}
            onChange={(v) => setF("roa_min", v)} />
          <FilterSlider label="営業利益率 以上" unit="%" value={filters.operating_margin_min} min={0} max={40} step={1}
            inactive={filters.operating_margin_min <= 0}
            onChange={(v) => setF("operating_margin_min", v)} />
          <FilterSlider label="売上成長率 上限" unit="%" value={filters.revenue_growth_max} min={5} max={50} step={5}
            inactive={filters.revenue_growth_max >= INACTIVE.revenue_growth_max}
            onChange={(v) => setF("revenue_growth_max", v)} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {/* 市場 */}
          <div>
            <p className="font-mono text-[9px] text-slate-500 mb-1">市場</p>
            <select
              value={filters.market}
              onChange={(e) => setF("market", e.target.value)}
              className="w-full rounded-lg border border-white/[0.18] bg-white/[0.14] px-2 py-1.5 font-mono text-xs text-slate-300 focus:outline-none"
            >
              {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          {/* バリューフラグ */}
          <div>
            <p className="font-mono text-[9px] text-slate-500 mb-1">判定フラグ</p>
            <select
              value={filters.value_flag}
              onChange={(e) => setF("value_flag", e.target.value)}
              className="w-full rounded-lg border border-white/[0.18] bg-white/[0.14] px-2 py-1.5 font-mono text-xs text-slate-300 focus:outline-none"
            >
              {VALUE_FLAGS.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* ── 件数 ── */}
      <div className="flex items-center gap-3 mb-4">
        <p className="font-mono text-xs text-slate-500">
          {loading ? "検索中..." : `${count} 件ヒット`}
          <span className="text-slate-500 ml-2">/ DB {totalCount} 銘柄</span>
        </p>
        <button
          onClick={search}
          className="ml-auto rounded-lg border border-white/[0.18] bg-white/[0.14] px-3 py-1 font-mono text-[10px] text-slate-400 hover:bg-white/[0.14] transition-all"
        >
          再検索
        </button>
      </div>

      {/* ── 結果テーブル ── */}
      {results.length === 0 && !loading ? (
        <div className="rounded-2xl border border-white/[0.15] bg-white/[0.02] p-10 text-center">
          <p className="text-sm text-slate-500">条件に合う銘柄が見つかりませんでした。フィルターを緩めてみてください。</p>
        </div>
      ) : (
        <>
          {results.length > 100 && (
            <div className="mb-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] px-4 py-2">
              <p className="font-mono text-[10px] text-amber-400">
                {results.length.toLocaleString()} 件ヒット — 上位 100 件を表示。条件を絞り込んでください。
              </p>
            </div>
          )}
          <div className="overflow-x-auto rounded-2xl border border-white/[0.22]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.15] bg-white/[0.11]">
                {["コード", "銘柄名", "市場", "判定", "株価", "PBR", "PER", "ROE", "ROA", "自己資本比", "利回り", "売上成長"].map((h) => (
                  <th key={h} className="px-3 py-2.5 font-mono text-[9px] text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {results.slice(0, 100).map((s, i) => (
                <tr
                  key={s.code}
                  className={`border-b border-white/[0.06] hover:bg-white/[0.11] transition-colors ${i % 2 === 0 ? "" : "bg-white/[0.01]"}`}
                >
                  <td className="px-3 py-2.5 font-mono text-[10px] text-slate-500">
                    <Link href={`/screener/${s.code}`} className="hover:text-[#38bdf8] transition-colors">{s.code}</Link>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-300 max-w-[140px] truncate">
                    <Link href={`/screener/${s.code}`} className="hover:text-[#e8f4ff] transition-colors">{s.name}</Link>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-[9px] text-slate-500">{s.market}</td>
                  <td className="px-3 py-2.5">
                    {s.value_flag ? (
                      <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] ${VALUE_FLAG_CLS[s.value_flag] ?? "text-slate-500"}`}>
                        {s.value_flag}
                      </span>
                    ) : (
                      <span className="font-mono text-[9px] text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{s.price != null ? `¥${s.price.toFixed(1)}` : "—"}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-[#34d399]">{num(s.pbr)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{num(s.per)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{pct(s.roe)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{pct(s.roa)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-slate-300">{pct(s.equity_ratio, 0)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-amber-400">{pct(s.dividend_yield)}</td>
                  <td className={`px-3 py-2.5 font-mono text-xs ${GROWTH_FLAG_CLS[s.growth_flag ?? ""] ?? "text-slate-500"}`}>
                    {s.growth_flag ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </>
      )}
    </div>
  );
}

function FilterSlider({
  label, unit, value, min, max, step, inactive, onChange,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  inactive?: boolean;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <p className={`font-mono text-[9px] ${inactive ? "text-slate-500" : "text-slate-400"}`}>{label}</p>
        <p className={`font-mono text-[9px] ${inactive ? "text-slate-500" : "text-[#38bdf8]"}`}>
          {inactive ? "制限なし" : `${value}${unit}`}
        </p>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={`w-full h-1 rounded-full cursor-pointer ${inactive ? "accent-slate-600" : "accent-[#38bdf8]"}`}
      />
    </div>
  );
}
