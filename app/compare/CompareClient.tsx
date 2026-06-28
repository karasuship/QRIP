"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

// ── モンテカルロ ────────────────────────────────────────────────────────────

function normalRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

interface SimResult {
  median: number;
  p10: number;
  p90: number;
  medianDD: number;
  p90DD: number;
  score: number;
}

function monteCarlo(mu: number, sigma: number, years: number, n = 1500): SimResult {
  // 対数正規分布 — 算術平均がmuになるようドリフト補正
  const lnMu = Math.log(1 + mu) - 0.5 * sigma * sigma;
  const finals: number[] = [];
  const maxDDs: number[] = [];

  for (let i = 0; i < n; i++) {
    let v = 1, peak = 1, maxDD = 0;
    for (let y = 0; y < years; y++) {
      v *= Math.exp(lnMu + sigma * normalRandom());
      if (v > peak) peak = v;
      const dd = (peak - v) / peak;
      if (dd > maxDD) maxDD = dd;
    }
    finals.push(v - 1);
    maxDDs.push(maxDD);
  }

  finals.sort((a, b) => a - b);
  maxDDs.sort((a, b) => a - b);

  const median = finals[Math.floor(n * 0.5)];
  const p90DD = maxDDs[Math.floor(n * 0.9)];

  return {
    median,
    p10:     finals[Math.floor(n * 0.1)],
    p90:     finals[Math.floor(n * 0.9)],
    medianDD: maxDDs[Math.floor(n * 0.5)],
    p90DD,
    score:   p90DD > 0 ? median / p90DD : 0,
  };
}

// ── 戦略定義 ────────────────────────────────────────────────────────────────

const STRATEGIES = [
  {
    id: "voo",
    name: "VOO 積立",
    mu: 0.105,
    sigma: 0.155,
    source: "SP500 長期平均（1926-2026, 名目）",
    color: "#38bdf8",
    tag: "ベースライン",
  },
  {
    id: "qqq",
    name: "QQQ 積立",
    mu: 0.150,
    sigma: 0.220,
    source: "QQQ 2000年以降実績から保守的推定",
    color: "#34d399",
    tag: "テック集中",
  },
  {
    id: "phi2",
    name: "VOO + phi2 シグナル",
    mu: 0.130,
    sigma: 0.140,
    source: "Round 21: TEST Z=+14.79。VOOベース+アルファ2-3%、シグナル時買い増しでDD抑制",
    color: "#a78bfa",
    tag: "推奨",
  },
  {
    id: "mag7",
    name: "Mag7 集中",
    mu: 0.200,
    sigma: 0.380,
    source: "2015-2026実績+44%を将来は保守的に20%と推定。2022年-52%のDD実績を反映",
    color: "#f87171",
    tag: "高リスク",
  },
] as const;

const HORIZONS = [10, 20, 30] as const;

type StrategyId = (typeof STRATEGIES)[number]["id"];
type Horizon = (typeof HORIZONS)[number];
type ResultMap = Record<StrategyId, Record<Horizon, SimResult>>;

// ── ユーティリティ ──────────────────────────────────────────────────────────

function pct(v: number, digits = 0) {
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
}

function rankColor(rank: number, total: number) {
  if (rank === 1) return "text-[#34d399] font-semibold";
  if (rank === 2) return "text-[#38bdf8]";
  if (rank === total) return "text-[#f87171]";
  return "text-slate-400";
}

function rankOf(value: number, values: number[], higher: boolean): number {
  const sorted = [...values].sort((a, b) => higher ? b - a : a - b);
  return sorted.indexOf(value) + 1;
}

// ── コンポーネント ──────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div className="mt-10 mb-3 flex items-center gap-3">
      <div className="h-px flex-1 bg-white/[0.13]" />
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">{label}</p>
      <div className="h-px flex-1 bg-white/[0.13]" />
    </div>
  );
}

export default function CompareClient() {
  const [results, setResults] = useState<ResultMap | null>(null);

  useEffect(() => {
    const map = {} as ResultMap;
    for (const s of STRATEGIES) {
      map[s.id] = {} as Record<Horizon, SimResult>;
      for (const h of HORIZONS) {
        map[s.id][h] = monteCarlo(s.mu, s.sigma, h);
      }
    }
    setResults(map);
  }, []);

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-mono text-xs text-slate-500">計算中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Compare / 戦略比較</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">期待値・リスク・総合スコア</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400 max-w-2xl">
            4戦略を10年・20年・30年でモンテカルロ比較（各1,500試行）。
            期待値が高い戦略ほどリスクも大きい。時間軸によって最適解が変わる。
          </p>
        </div>

        {/* 凡例 */}
        <div className="mt-5 flex flex-wrap gap-2">
          {STRATEGIES.map(s => (
            <span key={s.id} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.18] bg-white/[0.04] px-3 py-1 text-[10px]">
              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: s.color }} />
              <span className="text-[#e8f4ff]">{s.name}</span>
              <span className="text-slate-500">{s.tag}</span>
            </span>
          ))}
        </div>

        {/* ── 期待値 ── */}
        <Divider label="期待値 — 中央値リターン（50パーセンタイル）" />
        <p className="mb-3 text-[10px] text-slate-600">カッコ内: 悲観（10%ile）/ 楽観（90%ile）</p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                {["戦略", "10年", "20年", "30年"].map(h => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9px] text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRATEGIES.map(s => (
                <tr key={s.id} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: s.color }}>{s.name}</td>
                  {HORIZONS.map(h => {
                    const r = results[s.id][h];
                    const all = STRATEGIES.map(st => results[st.id][h].median);
                    const rank = rankOf(r.median, all, true);
                    return (
                      <td key={h} className="px-4 py-3">
                        <span className={`font-mono text-sm ${rankColor(rank, STRATEGIES.length)}`}>
                          {pct(r.median)}
                        </span>
                        <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                          {pct(r.p10)} / {pct(r.p90)}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── リスク ── */}
        <Divider label="リスク — 最大ドローダウン" />
        <p className="mb-3 text-[10px] text-slate-600">投資期間中に一度は経験する最大下落率。中央値（悲観は90%ile）</p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                {["戦略", "10年", "20年", "30年"].map(h => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9px] text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRATEGIES.map(s => (
                <tr key={s.id} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: s.color }}>{s.name}</td>
                  {HORIZONS.map(h => {
                    const r = results[s.id][h];
                    const all = STRATEGIES.map(st => results[st.id][h].medianDD);
                    const rank = rankOf(r.medianDD, all, false); // 低いほど良い
                    return (
                      <td key={h} className="px-4 py-3">
                        <span className={`font-mono text-sm ${rankColor(rank, STRATEGIES.length)}`}>
                          -{(r.medianDD * 100).toFixed(0)}%
                        </span>
                        <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                          悲観 -{(r.p90DD * 100).toFixed(0)}%
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── 総合スコア ── */}
        <Divider label="総合スコア — 期待値 ÷ リスク" />
        <p className="mb-3 text-[10px] text-slate-600">
          中央値リターン ÷ 悲観シナリオ最大DD。高いほどリターンとリスクのバランスが良い。
          <span className="text-[#34d399] ml-2">■ 1位</span>
          <span className="text-[#38bdf8] ml-2">■ 2位</span>
          <span className="text-[#f87171] ml-2">■ 最下位</span>
        </p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                {["戦略", "10年", "20年", "30年", "平均"].map(h => (
                  <th key={h} className="px-4 py-2.5 font-mono text-[9px] text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {STRATEGIES.map(s => {
                const scores = HORIZONS.map(h => results[s.id][h].score);
                const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
                const allAvg = STRATEGIES.map(st =>
                  HORIZONS.map(h => results[st.id][h].score).reduce((a, b) => a + b, 0) / HORIZONS.length
                );
                const avgRank = rankOf(avg, allAvg, true);
                return (
                  <tr key={s.id} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: s.color }}>{s.name}</td>
                    {HORIZONS.map(h => {
                      const r = results[s.id][h];
                      const all = STRATEGIES.map(st => results[st.id][h].score);
                      const rank = rankOf(r.score, all, true);
                      return (
                        <td key={h} className="px-4 py-3">
                          <span className={`font-mono text-sm ${rankColor(rank, STRATEGIES.length)}`}>
                            {r.score.toFixed(2)}
                          </span>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3">
                      <span className={`font-mono text-sm font-bold ${rankColor(avgRank, STRATEGIES.length)}`}>
                        {avg.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── 読み方 ── */}
        <section className="mt-8 rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.03] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8] mb-4">この表の読み方</p>
          <div className="space-y-3 text-[11px] leading-6 text-slate-400">
            <p>
              <span className="text-[#a78bfa] font-semibold">phi2+VOO が総合スコア最高になる理由：</span>
              Mag7集中は期待値が最大だが、悲観シナリオの最大DDも最大（-60%以上）。
              スコアは「どれだけ稼げるか」÷「どれだけ壊滅するか」なので、高リターン高リスクはスコアを上げにくい。
            </p>
            <p>
              <span className="text-[#34d399] font-semibold">時間軸が長くなるほどスコアが上がる理由：</span>
              長期になるほど複利効果が膨らみ期待値が増す。最大DDは時間軸によらずほぼ同じなので、
              分母が変わらず分子だけ大きくなる。長期投資が有利という事実の数値的な裏付け。
            </p>
            <p>
              <span className="text-amber-400 font-semibold">Mag7集中は「一度も-50%を見ない自信がある人」向け：</span>
              2022年にMag7は-52%を記録。このとき売らずに持ち続けた人だけが
              その後の回復（2023-2024で+115%）を取れた。
              スコアは低くても、行動できるなら期待値は最大。
            </p>
          </div>
        </section>

        {/* ── パラメータ根拠 ── */}
        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">パラメータと根拠</p>
          <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                  {["戦略", "年率μ", "年率σ", "根拠"].map(h => (
                    <th key={h} className="px-4 py-2.5 font-mono text-[9px] text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STRATEGIES.map(s => (
                  <tr key={s.id} className="border-b border-white/[0.06]">
                    <td className="px-4 py-2.5 font-mono text-xs font-semibold" style={{ color: s.color }}>{s.name}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-[#34d399]">+{(s.mu * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-amber-400">±{(s.sigma * 100).toFixed(1)}%</td>
                    <td className="px-4 py-2.5 text-[10px] text-slate-500 leading-5">{s.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-6 font-mono text-[9px] leading-6 text-slate-600">
          モンテカルロシミュレーション（各1,500試行）による確率的推定。対数正規分布を仮定。ファットテール・体制変化は考慮していない。
          Mag7のμ=20%は2015-2026実績（+44%）より保守的に推定。ページ読み込みごとに結果は変わります（確率論的）。
          将来の成果を保証しません。投資助言ではありません。
          詳細は <Link href="/learn" className="text-slate-500 hover:text-slate-400">根拠</Link> と <Link href="/research" className="text-slate-500 hover:text-slate-400">書庫</Link> を参照。
        </p>
      </main>
    </div>
  );
}
