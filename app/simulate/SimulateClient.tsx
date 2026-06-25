"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// ── 定数（バックテスト由来） ──────────────────────────────────────────────────

const ANNUAL_RATE = {
  savings:  0.001,   // 普通預金 0.1%
  dca:      0.104,   // SP500 歴史的平均
  phi2:     0.127,   // phi2戦略（+2.3%アルファ）
  dividend: 0.065,   // NTT・JT型配当株（配当3.5%+株価成長3%）
};

const TAX_RATE = 0.20315; // 譲渡益課税

// ── プリセット ────────────────────────────────────────────────────────────────

interface Preset {
  label: string;
  sub: string;
  monthly: number;
  bonusJune: number;
  bonusDec: number;
  years: number;
  nisa: "new" | "taxable" | "both";
  strategy: "dca" | "phi2" | "dividend";
}

const PRESETS: Preset[] = [
  {
    label: "積立NISA専念",
    sub: "新NISA枠を最大活用。毎月コツコツ型。",
    monthly: 100000,
    bonusJune: 0,
    bonusDec: 0,
    years: 30,
    nisa: "new",
    strategy: "dca",
  },
  {
    label: "積立＋ボーナス活用",
    sub: "月次積立＋年2回ボーナスを一括投下。",
    monthly: 50000,
    bonusJune: 200000,
    bonusDec: 200000,
    years: 25,
    nisa: "both",
    strategy: "dca",
  },
  {
    label: "phi2シグナル活用",
    sub: "DCA継続＋シグナル発動時に追加投入。",
    monthly: 50000,
    bonusJune: 100000,
    bonusDec: 100000,
    years: 30,
    nisa: "new",
    strategy: "phi2",
  },
  {
    label: "CF配当重視",
    sub: "NTT・JT型配当株中心。毎年の配当収入を確保。",
    monthly: 80000,
    bonusJune: 200000,
    bonusDec: 200000,
    years: 30,
    nisa: "new",
    strategy: "dividend",
  },
];

// ── シミュレーション ──────────────────────────────────────────────────────────

interface YearPoint {
  year: number;
  savings: number;
  main: number;
  mainAfterTax: number;
  totalInvested: number;
  annualDividend?: number;
}

function runSimulation(params: {
  monthly: number;
  bonusJune: number;
  bonusDec: number;
  years: number;
  nisa: "new" | "taxable" | "both";
  strategy: "dca" | "phi2" | "dividend";
}): YearPoint[] {
  const { monthly, bonusJune, bonusDec, years, nisa, strategy } = params;

  const annualRate = ANNUAL_RATE[strategy === "phi2" ? "phi2" : strategy === "dividend" ? "dividend" : "dca"];
  const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;
  const savingsMonthlyRate = Math.pow(1 + ANNUAL_RATE.savings, 1 / 12) - 1;

  // 新NISA年間上限: 360万
  const NISA_ANNUAL_LIMIT = 3_600_000;

  let portfolio = 0;
  let savingsPortfolio = 0;
  let totalInvested = 0;
  let nisaBalance = 0;  // NISA枠に入れた累計元本
  const result: YearPoint[] = [];

  for (let y = 1; y <= years; y++) {
    let nisaUsedThisYear = 0;

    for (let m = 1; m <= 12; m++) {
      // 月次積立
      let invest = monthly;
      // ボーナス
      if (m === 6)  invest += bonusJune;
      if (m === 12) invest += bonusDec;

      totalInvested += invest;

      // NISA枠判定
      let nisaInvest = 0;
      if (nisa !== "taxable") {
        const canUse = Math.max(0, NISA_ANNUAL_LIMIT - nisaUsedThisYear);
        nisaInvest = Math.min(invest, canUse);
        nisaUsedThisYear += nisaInvest;
        nisaBalance += nisaInvest;
      }

      portfolio = (portfolio + invest) * (1 + monthlyRate);
      savingsPortfolio = (savingsPortfolio + invest) * (1 + savingsMonthlyRate);
    }

    // 税引き後計算
    let afterTax = portfolio;
    if (nisa !== "new") {
      const gains = Math.max(0, portfolio - totalInvested);
      // NISA分は非課税。残りに課税（簡易: NISA枠は元本比例で非課税）
      const taxableRatio = nisa === "both"
        ? Math.max(0, 1 - nisaBalance / totalInvested)
        : 1;
      const taxableGains = gains * taxableRatio;
      afterTax = portfolio - taxableGains * TAX_RATE;
    }

    // 配当株の年間配当（配当利回り × 現在価値）
    const annualDividend = strategy === "dividend"
      ? Math.round(portfolio * 0.035)
      : undefined;

    result.push({
      year: y,
      savings: Math.round(savingsPortfolio),
      main: Math.round(portfolio),
      mainAfterTax: Math.round(afterTax),
      totalInvested: Math.round(totalInvested),
      annualDividend,
    });
  }

  return result;
}

// ── フォーマット ──────────────────────────────────────────────────────────────

function fmtMan(n: number): string {
  const man = Math.round(n / 10000);
  if (man >= 10000) return `${(man / 10000).toFixed(1)}億`;
  return `${man.toLocaleString("ja-JP")}万`;
}

function fmtYen(n: number): string {
  return `¥${n.toLocaleString("ja-JP")}`;
}

// ── チャート Tooltip ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0d1117]/95 px-3 py-2 text-xs backdrop-blur-sm">
      <p className="font-mono text-[10px] text-slate-500 mb-1">{label}年後</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmtMan(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────────────────────

export default function SimulateClient() {
  const [selectedPreset, setSelectedPreset] = useState(0);
  const [monthly, setMonthly] = useState(PRESETS[0].monthly);
  const [bonusJune, setBonusJune] = useState(PRESETS[0].bonusJune);
  const [bonusDec, setBonusDec] = useState(PRESETS[0].bonusDec);
  const [years, setYears] = useState(PRESETS[0].years);
  const [nisa, setNisa] = useState<"new" | "taxable" | "both">(PRESETS[0].nisa);
  const [strategy, setStrategy] = useState<"dca" | "phi2" | "dividend">(PRESETS[0].strategy);

  const applyPreset = (i: number) => {
    const p = PRESETS[i];
    setSelectedPreset(i);
    setMonthly(p.monthly);
    setBonusJune(p.bonusJune);
    setBonusDec(p.bonusDec);
    setYears(p.years);
    setNisa(p.nisa);
    setStrategy(p.strategy);
  };

  const data = useMemo(
    () => runSimulation({ monthly, bonusJune, bonusDec, years, nisa, strategy }),
    [monthly, bonusJune, bonusDec, years, nisa, strategy]
  );

  const last = data[data.length - 1];
  const totalInvested = last?.totalInvested ?? 0;
  const finalMain = last?.main ?? 0;
  const finalAfterTax = last?.mainAfterTax ?? 0;
  const finalSavings = last?.savings ?? 0;
  const taxSaved = finalMain - finalAfterTax;
  const vsNisaSavings = finalMain - finalSavings;

  // チャートデータ（5年刻み + 最終年）
  const chartData = data.filter((d) => d.year % 5 === 0 || d.year === years);

  const strategyLabel = strategy === "phi2" ? "phi2戦略" : strategy === "dividend" ? "配当株" : "SP500 DCA";
  const strategyColor = strategy === "phi2" ? "#34d399" : strategy === "dividend" ? "#f59e0b" : "#38bdf8";

  return (
    <div className="mt-6 space-y-8">

      {/* プリセット選択 */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          プロフィールを選ぶ
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESETS.map((p, i) => (
            <button
              key={i}
              onClick={() => applyPreset(i)}
              className={`text-left rounded-2xl border px-4 py-3 transition-all ${
                selectedPreset === i
                  ? "border-[#38bdf8]/40 bg-[#38bdf8]/[0.08]"
                  : "border-white/[0.10] bg-white/[0.03] hover:bg-white/[0.06]"
              }`}
            >
              <p className={`text-sm font-semibold ${selectedPreset === i ? "text-[#e8f4ff]" : "text-slate-300"}`}>
                {p.label}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{p.sub}</p>
            </button>
          ))}
        </div>
      </section>

      {/* カスタム入力 */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          条件を調整する
        </p>
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">月次積立（円）</p>
              <input
                type="number"
                value={monthly}
                onChange={(e) => { setMonthly(Number(e.target.value)); setSelectedPreset(-1); }}
                step={10000}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">6月ボーナス（円）</p>
              <input
                type="number"
                value={bonusJune}
                onChange={(e) => { setBonusJune(Number(e.target.value)); setSelectedPreset(-1); }}
                step={50000}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">12月ボーナス（円）</p>
              <input
                type="number"
                value={bonusDec}
                onChange={(e) => { setBonusDec(Number(e.target.value)); setSelectedPreset(-1); }}
                step={50000}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">運用期間（年）</p>
              <input
                type="number"
                value={years}
                onChange={(e) => { setYears(Math.min(40, Math.max(5, Number(e.target.value)))); setSelectedPreset(-1); }}
                min={5}
                max={40}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">NISA設定</p>
              <select
                value={nisa}
                onChange={(e) => { setNisa(e.target.value as "new" | "taxable" | "both"); setSelectedPreset(-1); }}
                className="w-full rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              >
                <option value="new">新NISA（非課税）</option>
                <option value="both">NISA＋課税口座</option>
                <option value="taxable">課税口座のみ</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">投資戦略</p>
              <select
                value={strategy}
                onChange={(e) => { setStrategy(e.target.value as "dca" | "phi2" | "dividend"); setSelectedPreset(-1); }}
                className="w-full rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"
              >
                <option value="dca">SP500 DCA（10.4%/年）</option>
                <option value="phi2">phi2戦略（12.7%/年）</option>
                <option value="dividend">配当株（6.5%/年）</option>
              </select>
            </div>
          </div>
        </div>
      </section>

      {/* 結果サマリー */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          {years}年後の試算
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "投資元本", value: fmtMan(totalInvested), color: "text-slate-400", sub: "総投入額" },
            { label: strategyLabel, value: fmtMan(finalMain), color: `text-[${strategyColor}]`, sub: "税引前" },
            { label: "税引後", value: fmtMan(finalAfterTax), color: "text-[#e8f4ff]", sub: nisa === "new" ? "NISA非課税" : `課税後 (${TAX_RATE * 100}%)` },
            { label: "普通預金", value: fmtMan(finalSavings), color: "text-slate-600", sub: "0.1%/年" },
          ].map((c) => (
            <div key={c.label} className="rounded-2xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-center">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">{c.label}</p>
              <p className={`font-mono text-xl font-bold mt-1 ${c.color}`}>{c.value}</p>
              <p className="font-mono text-[9px] text-slate-700 mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* キー指標 */}
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.05] px-4 py-3">
            <p className="font-mono text-[9px] uppercase text-[#34d399]/70">vs 預金の差</p>
            <p className="font-mono text-lg font-bold text-[#34d399] mt-0.5">{fmtMan(vsNisaSavings)}</p>
            <p className="font-mono text-[9px] text-slate-600">投資で得られる追加資産</p>
          </div>
          {nisa !== "new" && (
            <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/[0.05] px-4 py-3">
              <p className="font-mono text-[9px] uppercase text-[#f87171]/70">課税で失う額</p>
              <p className="font-mono text-lg font-bold text-[#f87171] mt-0.5">{fmtMan(taxSaved)}</p>
              <p className="font-mono text-[9px] text-slate-600">NISA なら節約できた税金</p>
            </div>
          )}
          {strategy === "dividend" && last?.annualDividend && (
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
              <p className="font-mono text-[9px] uppercase text-amber-400/70">{years}年後の年間配当</p>
              <p className="font-mono text-lg font-bold text-amber-400 mt-0.5">{fmtYen(last.annualDividend)}</p>
              <p className="font-mono text-[9px] text-slate-600">配当利回り 3.5% 想定</p>
            </div>
          )}
          {strategy === "phi2" && (
            <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.05] px-4 py-3">
              <p className="font-mono text-[9px] uppercase text-[#34d399]/70">phi2アルファ（累積）</p>
              <p className="font-mono text-lg font-bold text-[#34d399] mt-0.5">
                {fmtMan(finalMain - (() => {
                  const d = runSimulation({ monthly, bonusJune, bonusDec, years, nisa, strategy: "dca" });
                  return d[d.length - 1]?.main ?? 0;
                })())}
              </p>
              <p className="font-mono text-[9px] text-slate-600">DCA比 +2.3%/年の複利効果</p>
            </div>
          )}
        </div>
      </section>

      {/* 成長チャート */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          資産推移
        </p>
        <div className="h-64 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis
                dataKey="year"
                tickFormatter={(v) => `${v}年`}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => fmtMan(v)}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "ui-monospace, monospace" }}
                axisLine={false}
                tickLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(v) => <span className="font-mono text-[10px] text-slate-400">{v}</span>}
              />
              <Area
                type="monotone"
                dataKey="savings"
                name="普通預金"
                stroke="#475569"
                fill="rgba(71,85,105,0.08)"
                strokeWidth={1}
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="totalInvested"
                name="投資元本"
                stroke="rgba(255,255,255,0.2)"
                fill="rgba(255,255,255,0.03)"
                strokeWidth={1}
                strokeDasharray="4 2"
                dot={false}
              />
              <Area
                type="monotone"
                dataKey="main"
                name={strategyLabel}
                stroke={strategyColor}
                fill={`${strategyColor}18`}
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 年次テーブル（10年ごと） */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">年次推移（10年ごと）</p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.12]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.10] bg-white/[0.05]">
              <tr>
                {["経過年", "投資元本", strategyLabel, "税引後", "普通預金"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.filter((d) => d.year % 10 === 0 || d.year === years).map((d) => (
                <tr key={d.year} className="border-t border-white/[0.08] hover:bg-white/[0.03]">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{d.year}年後</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{fmtMan(d.totalInvested)}</td>
                  <td className={`px-4 py-2.5 font-mono text-xs font-semibold`} style={{ color: strategyColor }}>{fmtMan(d.main)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#e8f4ff]">{fmtMan(d.mainAfterTax)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{fmtMan(d.savings)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 注意書き */}
      <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 space-y-1">
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">前提・免責</p>
        <ul className="mt-1 space-y-0.5 font-mono text-[10px] leading-5 text-slate-700">
          <li>· SP500 DCA: 年率10.4%（1993〜2024 幾何平均、実際のリターンは変動します）</li>
          <li>· phi2戦略: 年率12.7%（DCA + バックテスト由来+2.3%アルファ。将来の保証なし）</li>
          <li>· 配当株: 年率6.5%（配当3.5%+株価成長3%の仮定。銘柄・時期により大きく異なります）</li>
          <li>· 新NISA: 年間360万まで非課税。超過分は課税口座として計算</li>
          <li>· 課税: 利益の20.315%を最終年に一括徴収として簡易計算（実際は売却時に課税）</li>
          <li>· これは投資助言ではありません。最終判断はご自身でお願いします。</li>
        </ul>
      </div>
    </div>
  );
}
