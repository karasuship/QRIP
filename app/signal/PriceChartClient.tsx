"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid,
  ReferenceLine, ReferenceArea,
} from "recharts";

// ── 統計ゾーン定義（バックテスト由来）────────────────────────
// drawdownFromATH が負の値（例: -0.12 = ATH比-12%）
interface Zone {
  minDd: number;  // 例: -0.15
  maxDd: number;  // 例: -0.10
  id: string;
  label: string;
  color: string;
  borderColor: string;
  bgColor: string;
  headline: string;
  stats: {
    source: string;
    ret63d: string;
    winPct?: number;
    note: string;
  };
}

const ZONES: Zone[] = [
  {
    minDd: -Infinity, maxDd: -0.20,
    id: "deep",
    label: "急落圏 −20%以上",
    color: "text-amber-400",
    borderColor: "border-amber-400/30",
    bgColor: "bg-amber-400/[0.07]",
    headline: "歴史的な急落局面",
    stats: {
      source: "SP500 1993-2024（GFC含む）",
      ret63d: "+11〜+15%（DCA比）",
      note: "GFC/コロナ级の急落。phi2+RSI<25同時発動に注目。全ての暴落はいつか回復した。",
    },
  },
  {
    minDd: -0.20, maxDd: -0.15,
    id: "quality",
    label: "★ 最高品質ゾーン −15〜−20%",
    color: "text-[#34d399]",
    borderColor: "border-[#34d399]/30",
    bgColor: "bg-[#34d399]/[0.06]",
    headline: "過去データで最も期待値が高い深さ",
    stats: {
      source: "R40バックテスト n=12",
      ret63d: "+9.8%（DCA比）",
      winPct: 83,
      note: "TEST Z=+6.75。phi2 v3が高品質で発動する深さ。CRS>=4で確度が上がる。",
    },
  },
  {
    minDd: -0.15, maxDd: -0.10,
    id: "phi2",
    label: "phi2 発動圏 −10〜−15%",
    color: "text-[#34d399]",
    borderColor: "border-[#34d399]/30",
    bgColor: "bg-[#34d399]/[0.04]",
    headline: "phi2 v3 シグナルが発動しやすいゾーン",
    stats: {
      source: "phi2 v3 TEST n=18",
      ret63d: "+7.17%（DCA比）",
      winPct: 77,
      note: "当日-2%以下かつCRS>=2の条件を満たすと発動。63日間で平均+7.17%のアウトパフォーム。",
    },
  },
  {
    minDd: -0.10, maxDd: -0.05,
    id: "watch",
    label: "監視圏 −5〜−10%",
    color: "text-amber-400",
    borderColor: "border-amber-400/20",
    bgColor: "bg-amber-400/[0.04]",
    headline: "phi2 発動まであと一歩",
    stats: {
      source: "シグナル未発動",
      ret63d: "DCAと同等（期待値の優位なし）",
      note: "ATH-10%まで下がれば phi2 条件達成の可能性。CRSスコアを注視。焦りは禁物。",
    },
  },
];

function getZone(dd: number): Zone | null {
  return ZONES.find((z) => dd <= z.maxDd && dd > z.minDd) ?? null;
}

// ── 回復統計テーブル ──────────────────────────────────────────
const RECOVERY = [
  { range: "−5〜−10%",  label: "軽微な調整",    avgDays: "約30日",  note: "通常の株価ノイズ" },
  { range: "−10〜−20%", label: "調整局面",       avgDays: "約110日", note: "phi2発動圏。焦らず保有" },
  { range: "−20〜−40%", label: "ベア相場",       avgDays: "約380日", note: "1〜2年で回復が多い" },
  { range: "−40%以上",  label: "歴史的暴落",     avgDays: "約1500日",note: "GFC・ドットコム。でも全て回復" },
];

// ── Tooltip ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0d1117]/95 px-3 py-2 font-mono text-xs backdrop-blur-sm">
      <p className="text-[10px] text-slate-500">{d.dateLabel}</p>
      <p className="text-[#34d399]">${d.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
    </div>
  );
}

// ── 型 ────────────────────────────────────────────────────────
interface PricePoint { time: number; close: number }
interface ChartData { dateLabel: string; close: number; time: number }

type Range = "5d" | "1mo" | "6mo" | "1y" | "2y";

const RANGE_LABELS: [Range, string][] = [
  ["5d", "5日"], ["1mo", "1ヶ月"], ["6mo", "6ヶ月"], ["1y", "1年"], ["2y", "2年"],
];

// ── メインコンポーネント ──────────────────────────────────────
export default function PriceChartClient() {
  const [range, setRange]       = useState<Range>("1y");
  const [data, setData]         = useState<ChartData[] | null>(null);
  const [ath52w, setAth52w]     = useState<number | null>(null);
  const [latest, setLatest]     = useState<number | null>(null);
  const [drawdown, setDrawdown] = useState<number | null>(null);
  const [ticker, setTicker]     = useState<string>("^GSPC");
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async (r: Range) => {
    try {
      const res = await fetch(`/api/price-history?t=%5EGSPC&r=${r}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);

      const pts: PricePoint[] = json.points;
      const isIntraday = r === "5d";

      const chartData: ChartData[] = pts.map((p) => {
        const d = new Date(p.time);
        const dateLabel = isIntraday
          ? d.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/New_York" }) + " ET"
          : d.toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" });
        return { time: p.time, close: p.close, dateLabel };
      });

      setData(chartData);
      setAth52w(json.ath52w);
      setLatest(json.latest);
      setDrawdown(json.drawdown);
      setTicker(json.ticker);
      setUpdatedAt(json.updatedAt);
      setError(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // 初回＆レンジ変更時
  useEffect(() => {
    setLoading(true);
    fetchData(range);
  }, [range, fetchData]);

  // 5分ごとに自動更新
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => fetchData(range), 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [range, fetchData]);

  const zone = drawdown != null ? getZone(drawdown) : null;

  // Y軸の表示範囲（ATH + 少し上まで表示）
  const yDomain = data && ath52w
    ? [Math.floor(Math.min(...data.map(d => d.close)) * 0.97), Math.ceil(ath52w * 1.02)]
    : ["auto", "auto"];

  // ATH比のラインY値
  const ath10Line = ath52w ? ath52w * 0.90 : null;
  const ath20Line = ath52w ? ath52w * 0.80 : null;

  const minutesSinceUpdate = updatedAt ? Math.floor((Date.now() - updatedAt) / 60000) : null;

  return (
    <div className="space-y-4">

      {/* ── ヘッダー ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-bold text-slate-200">
            {ticker.startsWith("^") ? ticker.replace("^", "") : ticker}
          </span>
          {latest && (
            <span className="font-mono text-lg text-slate-300">
              ${latest.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          )}
          {drawdown != null && (
            <span className={`font-mono text-sm ${drawdown < -0.10 ? "text-[#34d399]" : drawdown < -0.05 ? "text-amber-400" : drawdown < 0 ? "text-slate-400" : "text-slate-500"}`}>
              {drawdown >= 0 ? "ATH付近" : `ATH比 ${(drawdown * 100).toFixed(1)}%`}
            </span>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-slate-700">
            15分遅延 · {minutesSinceUpdate != null ? `${minutesSinceUpdate}分前更新` : "更新中"}
          </span>
          <button onClick={() => fetchData(range)} className="font-mono text-[10px] text-slate-600 hover:text-slate-400 transition-colors">↻</button>
          <div className="flex gap-1">
            {RANGE_LABELS.map(([r, l]) => (
              <button key={r} onClick={() => setRange(r)}
                className={`rounded-lg border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                  range === r ? "border-white/[0.20] text-slate-300" : "border-white/[0.08] text-slate-600 hover:text-slate-400"
                }`}>{l}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── チャート本体 ─────────────────────────── */}
      <div className="relative rounded-2xl border border-white/[0.10] bg-white/[0.03] p-3" style={{ height: 260 }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[10px] text-slate-600 animate-pulse">データ取得中...</span>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-mono text-[10px] text-red-500">{error}</span>
          </div>
        )}
        {!loading && !error && data && (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#34d399" stopOpacity={0.12}/>
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)"/>
              <XAxis
                dataKey="dateLabel"
                tick={{ fill: "#475569", fontSize: 9, fontFamily: "ui-monospace,monospace" }}
                axisLine={false} tickLine={false}
                interval={Math.floor(data.length / 6)}
              />
              <YAxis
                domain={yDomain as [number|string, number|string]}
                tick={{ fill: "#475569", fontSize: 9, fontFamily: "ui-monospace,monospace" }}
                axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
                width={54}
              />
              <Tooltip content={<ChartTooltip />}/>

              {/* phi2ゾーン（ATH-10%〜-20%を薄くハイライト） */}
              {ath10Line && ath20Line && (
                <ReferenceArea
                  y1={ath20Line} y2={ath10Line}
                  fill="#34d399" fillOpacity={0.04}
                  stroke="none"
                />
              )}

              {/* 基準ライン */}
              {ath52w && (
                <ReferenceLine y={ath52w}
                  stroke="rgba(255,255,255,0.25)" strokeDasharray="5 3"
                  label={{ value: "52週高値", fill: "rgba(255,255,255,0.3)", fontSize: 9, fontFamily: "ui-monospace,monospace", position: "insideTopRight" }}
                />
              )}
              {ath10Line && (
                <ReferenceLine y={ath10Line}
                  stroke="rgba(52,211,153,0.35)" strokeDasharray="3 2"
                  label={{ value: "ATH-10%", fill: "rgba(52,211,153,0.5)", fontSize: 8, fontFamily: "ui-monospace,monospace", position: "insideTopRight" }}
                />
              )}
              {ath20Line && (
                <ReferenceLine y={ath20Line}
                  stroke="rgba(251,191,36,0.35)" strokeDasharray="3 2"
                  label={{ value: "ATH-20%", fill: "rgba(251,191,36,0.5)", fontSize: 8, fontFamily: "ui-monospace,monospace", position: "insideTopRight" }}
                />
              )}

              {/* 現在値ライン */}
              {latest && (
                <ReferenceLine y={latest}
                  stroke="rgba(255,255,255,0.15)" strokeDasharray="2 2"
                />
              )}

              <Area
                type="monotone" dataKey="close" name="終値"
                stroke="#34d399" strokeWidth={1.5}
                fill="url(#priceGrad)"
                dot={false} activeDot={{ r: 3, fill: "#34d399", stroke: "#0d1117", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── 狼狽売り防止パネル ───────────────────── */}
      {drawdown != null && drawdown < -0.05 && zone && (
        <div className={`rounded-2xl border p-4 ${zone.borderColor} ${zone.bgColor}`}>
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${zone.color} ${zone.borderColor}`}>
              {zone.label}
            </div>
          </div>

          <h3 className={`mt-2 font-mono text-sm font-bold ${zone.color}`}>{zone.headline}</h3>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">データソース</p>
              <p className="mt-0.5 font-mono text-xs text-slate-300">{zone.stats.source}</p>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">63日後の期待リターン</p>
              <p className={`mt-0.5 font-mono text-sm font-bold ${zone.color}`}>{zone.stats.ret63d}</p>
            </div>
            {zone.stats.winPct && (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">プラスリターン率</p>
                <p className={`mt-0.5 font-mono text-sm font-bold ${zone.color}`}>{zone.stats.winPct}%</p>
              </div>
            )}
          </div>

          <p className="mt-2 font-mono text-[10px] leading-5 text-slate-500">{zone.stats.note}</p>
        </div>
      )}

      {/* ATH付近の場合（下落していない）*/}
      {drawdown != null && drawdown > -0.05 && (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
          <p className="font-mono text-xs text-slate-400">
            <span className="text-slate-300">ATH付近 —</span> phi2シグナル未発動。高値圏では積立DCAを淡々と継続。
            ATH比−10%を超えた時点で本パネルに統計データが表示されます。
          </p>
        </div>
      )}

      {/* ── SP500 回復統計テーブル ──────────────── */}
      <details className="group">
        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-widest text-slate-600 hover:text-slate-400 transition-colors list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
          SP500 過去の下落と回復期間（参考）
        </summary>
        <div className="mt-2 overflow-x-auto rounded-xl border border-white/[0.08]">
          <table className="w-full text-xs min-w-[480px]">
            <thead className="border-b border-white/[0.08] bg-white/[0.04]">
              <tr>
                {["下落幅","分類","平均回復期間","解説"].map(h => (
                  <th key={h} className="px-3 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECOVERY.map((r, i) => (
                <tr key={i} className="border-t border-white/[0.08] hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-[#34d399]">{r.range}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-300">{r.label}</td>
                  <td className="px-3 py-2.5 font-mono text-amber-400">{r.avgDays}</td>
                  <td className="px-3 py-2.5 font-mono text-slate-600 text-[10px]">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 font-mono text-[9px] text-slate-700">出典: SP500 1926〜2024の全調整・弱気相場の中央値。GFCと2020コロナを含む。1929年の大恐慌は除外。</p>
      </details>
    </div>
  );
}
