"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ResponsiveContainer, ComposedChart, Area, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import TermTooltip from "@/app/components/TermTooltip";
import QuickRef from "@/app/components/QuickRef";

// ── 定数 ─────────────────────────────────────────────────────
const TAX      = 0.20315;
const NISA_MAX = 18_000_000;   // 1800万生涯上限
const NISA_ANN = 3_600_000;    // 年360万上限

// SP500実績年次リターン（1994〜2024）
const SP500_HIST: Record<number, number> = {
  1994:-0.015, 1995:0.342, 1996:0.230, 1997:0.331, 1998:0.285,
  1999:0.210,  2000:-0.091,2001:-0.119,2002:-0.221,2003:0.287,
  2004:0.108,  2005:0.048, 2006:0.158, 2007:0.055, 2008:-0.370,
  2009:0.265,  2010:0.151, 2011:0.021, 2012:0.160, 2013:0.323,
  2014:0.137,  2015:0.014, 2016:0.119, 2017:0.218, 2018:-0.044,
  2019:0.314,  2020:0.184, 2021:0.287, 2022:-0.183,2023:0.264,
  2024:0.231,
};
const HIST_YRS = Object.keys(SP500_HIST).map(Number);

// ── 型 ────────────────────────────────────────────────────────
interface Asset {
  id: string;
  name: string;
  pct: number;        // 配分%
  totalRet: number;   // 年率トータルリターン%（DRIP前提）
  divYield: number;   // 配当利回り%
  drip: boolean;      // 配当再投資
}

interface SimPoint {
  label: string;
  year: number;
  month: number;        // 1-12
  portfolio: number;
  nisa: number;
  taxable: number;
  afterTax: number;
  invested: number;
  divCash: number;      // この期間の現金配当
  withdrawal: number;   // この期間の取り崩し額
  safe4pct: number;     // 4%ルール月額
  nisaProgress: number;
}

// ── 資産プリセット ────────────────────────────────────────────
const PRESETS: Omit<Asset,"id"|"pct">[] = [
  { name:"VOO（S&P500）",    totalRet:10.4, divYield:1.3, drip:true  },
  { name:"QQQ（NASDAQ-100）",totalRet:13.8, divYield:0.6, drip:true  },
  { name:"VEA（先進国）",    totalRet:6.8,  divYield:3.2, drip:true  },
  { name:"VWO（新興国）",    totalRet:4.5,  divYield:3.5, drip:true  },
  { name:"NTT・JT配当株",    totalRet:6.5,  divYield:3.5, drip:false },
  { name:"TOPIX（日本全体）",totalRet:5.2,  divYield:2.1, drip:true  },
  { name:"カスタム",         totalRet:8.0,  divYield:2.0, drip:true  },
];

function newAsset(preset: number, pct: number): Asset {
  return { id: crypto.randomUUID(), pct, ...PRESETS[Math.min(preset, PRESETS.length-1)] };
}

// ── シミュレーション ──────────────────────────────────────────
function runSim(p: {
  initialLump: number;
  monthly: number;
  monthlyGrowthPct: number;
  bonusMonths: Set<number>;
  bonusAmount: number;
  accumYears: number;
  assets: Asset[];
  nisaMode: "new"|"taxable"|"both";
  enableDecum: boolean;
  decumYears: number;
  withdrawMode: "fixed"|"4pct"|"yield";
  fixedMonthly: number;
  scenario: "base"|"bear"|"crash"|"hist";
  crashYear: number;
  histStart: number;
}): SimPoint[] {
  const {
    initialLump, monthly, monthlyGrowthPct, bonusMonths, bonusAmount,
    accumYears, assets, nisaMode, enableDecum, decumYears,
    withdrawMode, fixedMonthly, scenario, crashYear, histStart,
  } = p;

  // 加重平均の有効コンパウンドリターン（DRIP分のみ再投資）
  function wEffRet(assets: Asset[]) {
    return assets.reduce((s, a) => {
      const eff = a.drip ? a.totalRet / 100 : (a.totalRet - a.divYield) / 100;
      return s + eff * (a.pct / 100);
    }, 0);
  }
  // 現金配当利回り（DRIP=falseの分）
  function wCashDiv(assets: Asset[]) {
    return assets.reduce((s, a) => s + (a.drip ? 0 : a.divYield / 100) * (a.pct / 100), 0);
  }

  let nisaV = 0, taxV = 0;
  let nisaInvested = 0, taxInvested = 0;
  let totalInvested = 0;
  let curMonthly = monthly;

  // 初期一括
  if (initialLump > 0) {
    totalInvested += initialLump;
    if (nisaMode !== "taxable") {
      const toN = Math.min(initialLump, NISA_MAX, NISA_ANN);
      nisaV += toN; nisaInvested += toN;
      taxV += initialLump - toN; taxInvested += initialLump - toN;
    } else {
      taxV += initialLump; taxInvested += initialLump;
    }
  }

  const totalYears = accumYears + (enableDecum ? decumYears : 0);
  const result: SimPoint[] = [];

  // 退職時ポートフォリオ（4%ルール計算用）
  let retirePf = 0;

  for (let y = 1; y <= totalYears; y++) {
    // この年の有効リターン
    let effRet = wEffRet(assets);
    const cdYield = wCashDiv(assets);

    if (scenario === "bear")  effRet -= 0.03;
    else if (scenario === "crash" && y === crashYear) effRet = -0.40;
    else if (scenario === "hist") {
      const yr = histStart + y - 1;
      const idx = ((yr - HIST_YRS[0]) % HIST_YRS.length + HIST_YRS.length) % HIST_YRS.length;
      effRet = SP500_HIST[HIST_YRS[idx]] - cdYield;
    }

    const mRet = Math.pow(1 + Math.max(effRet, -0.99), 1 / 12) - 1;
    const isAccum = y <= accumYears;
    let nisaUsedY = 0;
    let yearDiv = 0, yearWith = 0;

    if (!isAccum && y === accumYears + 1) {
      retirePf = nisaV + taxV;
    }

    for (let m = 0; m < 12; m++) {
      const pf = nisaV + taxV;
      const divCash = pf * cdYield / 12;
      yearDiv += divCash;

      // 複利成長
      nisaV *= (1 + mRet);
      taxV  *= (1 + mRet);

      if (isAccum) {
        let invest = curMonthly;
        if (bonusMonths.has(m)) invest += bonusAmount;
        totalInvested += invest;

        if (nisaMode !== "taxable") {
          const remLife = Math.max(0, NISA_MAX - nisaInvested);
          const remAnn  = Math.max(0, NISA_ANN - nisaUsedY);
          const toN = Math.min(invest, remLife, remAnn);
          nisaV += toN; nisaInvested += toN; nisaUsedY += toN;
          const toT = invest - toN;
          taxV += toT; taxInvested += toT;
        } else {
          taxV += invest; taxInvested += invest;
        }
      } else {
        // 取り崩し
        let mWith = 0;
        if (withdrawMode === "4pct")  mWith = (retirePf * 0.04) / 12;
        else if (withdrawMode === "fixed") mWith = fixedMonthly;
        else mWith = divCash; // yield only
        yearWith += mWith;

        // 課税口座から先に取り崩す（NISAを温存）
        const fromT = Math.min(mWith, taxV);
        taxV -= fromT;
        if (taxInvested > 0 && taxV > 0) taxInvested *= taxV / (taxV + fromT);
        else taxInvested = 0;
        nisaV = Math.max(0, nisaV - (mWith - fromT));
      }
    }

    // 月次積立額の増加
    if (isAccum) curMonthly *= (1 + monthlyGrowthPct / 100);

    const pf = nisaV + taxV;
    const gain = Math.max(0, taxV - taxInvested);
    const afterTax = nisaV + taxV - gain * TAX;

    // 毎年12月末にスナップショット
    result.push({
      label: `${y}年後`,
      year: y,
      month: 12,
      portfolio: Math.round(pf),
      nisa: Math.round(nisaV),
      taxable: Math.round(taxV),
      afterTax: Math.round(afterTax),
      invested: Math.round(totalInvested),
      divCash: Math.round(yearDiv),
      withdrawal: Math.round(yearWith),
      safe4pct: Math.round(pf * 0.04 / 12),
      nisaProgress: Math.round(nisaInvested),
    });
  }
  return result;
}

// ── フォーマット ──────────────────────────────────────────────
function fMan(n: number) {
  const m = Math.round(n / 10000);
  if (m >= 10000) return `${(m / 10000).toFixed(1)}億`;
  return `${m.toLocaleString("ja-JP")}万`;
}
function fYen(n: number) { return `¥${n.toLocaleString("ja-JP")}`; }

// ── Tooltip ───────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/[0.12] bg-[#0d1117]/95 px-3 py-2 text-xs backdrop-blur-sm">
      <p className="font-mono text-[10px] text-slate-500 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color ?? p.fill }} className="font-mono">
          {p.name}: {fMan(p.value)}
        </p>
      ))}
    </div>
  );
}

const MONTH_NAMES = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];
const ASSET_COLORS = ["#34d399","#38bdf8","#f59e0b"];

// ── メイン ────────────────────────────────────────────────────
export default function SimulateClient() {

  // ── 積立設定 ─────────────────────────
  const [initialLump, setInitialLump] = useState(0);
  const [monthly, setMonthly] = useState(50000);
  const [monthlyGrowthPct, setMonthlyGrowthPct] = useState(0);
  const [bonusMonths, setBonusMonths] = useState<Set<number>>(new Set([5, 11]));
  const [bonusAmount, setBonusAmount] = useState(200000);
  const [accumYears, setAccumYears] = useState(30);

  // ── 資産配分 ─────────────────────────
  const [assets, setAssets] = useState<Asset[]>([
    newAsset(0, 50),
    newAsset(2, 30),
    newAsset(1, 20),
  ]);

  // ── NISA設定 ─────────────────────────
  const [nisaMode, setNisaMode] = useState<"new"|"taxable"|"both">("new");

  // ── 取り崩し ─────────────────────────
  const [enableDecum, setEnableDecum] = useState(false);
  const [decumYears, setDecumYears] = useState(20);
  const [withdrawMode, setWithdrawMode] = useState<"fixed"|"4pct"|"yield">("4pct");
  const [fixedMonthly, setFixedMonthly] = useState(150000);

  // ── シナリオ ─────────────────────────
  const [scenario, setScenario] = useState<"base"|"bear"|"crash"|"hist">("base");
  const [crashYear, setCrashYear] = useState(10);
  const [histStart, setHistStart] = useState(1994);

  // ── 表示 ─────────────────────────────
  const [chartMode, setChartMode] = useState<"wealth"|"dividend"|"withdrawal">("wealth");
  const [showAllYears, setShowAllYears] = useState(false);

  // ── 配分合計バリデーション ────────────
  const totalPct = assets.reduce((s, a) => s + a.pct, 0);
  const pctOk = Math.abs(totalPct - 100) < 0.5;

  // ── 実行（メイン）────────────────────
  const simParams = {
    initialLump, monthly, monthlyGrowthPct, bonusMonths, bonusAmount,
    accumYears, assets, nisaMode, enableDecum, decumYears,
    withdrawMode, fixedMonthly, scenario, crashYear, histStart,
  };
  const data = useMemo(() => runSim(simParams), [
    initialLump, monthly, monthlyGrowthPct, bonusMonths, bonusAmount,
    accumYears, assets, nisaMode, enableDecum, decumYears,
    withdrawMode, fixedMonthly, scenario, crashYear, histStart,
  ]);

  // ── 参照シミュレーション ──────────────
  // ① ボーナスなし（月次のみ・同リターン率）
  const noBonusData = useMemo(() => runSim({
    ...simParams,
    bonusMonths: new Set<number>(),
    bonusAmount: 0,
  }), [
    initialLump, monthly, monthlyGrowthPct, accumYears, assets, nisaMode,
    enableDecum, decumYears, withdrawMode, fixedMonthly, scenario, crashYear, histStart,
  ]);

  // ② 同額均等DCA（同じ総資金を毎月均等投入・同リターン率）
  // ボーナス分を月割りにして再分配。月額増加率は適用しない（均等なので）
  const uniformData = useMemo(() => {
    const bonusPerYear = bonusAmount * bonusMonths.size;
    const uniformMonthly = monthly + bonusPerYear / 12;
    return runSim({
      ...simParams,
      monthly: uniformMonthly,
      monthlyGrowthPct: 0,  // 均等のため成長なし
      bonusMonths: new Set<number>(),
      bonusAmount: 0,
    });
  }, [
    initialLump, monthly, bonusMonths, bonusAmount, accumYears, assets, nisaMode,
    enableDecum, decumYears, withdrawMode, fixedMonthly, scenario, crashYear, histStart,
  ]);

  const last = data[data.length - 1];
  const endAccum = data[accumYears - 1];
  const tableData = showAllYears ? data : data.filter((d) => d.year % 5 === 0 || d.year === 1 || d.year === (enableDecum ? accumYears + decumYears : accumYears));

  // チャート用: 各年末の3本線をマージ
  const chartData = data
    .filter((d) => d.year % 5 === 0 || d.year === 1 || d.year === last.year)
    .map((d) => ({
      ...d,
      noBonusPf:  noBonusData[d.year - 1]?.portfolio  ?? 0,
      uniformPf:  uniformData[d.year - 1]?.portfolio  ?? 0,
    }));

  // ── 資産編集 ─────────────────────────
  const updateAsset = useCallback((id: string, key: keyof Asset, val: unknown) => {
    setAssets((prev) => prev.map((a) => a.id === id ? { ...a, [key]: val } : a));
  }, []);

  const removeAsset = useCallback((id: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const addAsset = useCallback(() => {
    if (assets.length >= 3) return;
    setAssets((prev) => [...prev, newAsset(0, Math.max(0, 100 - totalPct))]);
  }, [assets.length, totalPct]);

  const toggleBonus = (m: number) => {
    setBonusMonths((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m); else next.add(m);
      return next;
    });
  };

  return (
    <div className="mt-6 space-y-8">

      {/* ━━ 積立設定 ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">積立設定</p>
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4 space-y-4">

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">初期一括投入（円）</p>
              <input type="number" value={initialLump} onChange={(e)=>setInitialLump(+e.target.value)} step={100000}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
            </label>
            <label className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">月次積立（円）</p>
              <input type="number" value={monthly} onChange={(e)=>setMonthly(+e.target.value)} step={10000}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
            </label>
            <label className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">月額の年率増加（%）</p>
              <input type="number" value={monthlyGrowthPct} onChange={(e)=>setMonthlyGrowthPct(+e.target.value)} step={0.5} min={0} max={10}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
            </label>
            <label className="space-y-1">
              <p className="font-mono text-[9px] uppercase text-slate-600">積立期間（年）</p>
              <input type="number" value={accumYears} onChange={(e)=>setAccumYears(Math.max(1,Math.min(40,+e.target.value)))} step={1} min={1} max={40}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
            </label>
          </div>

          {/* ボーナス月 */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <p className="font-mono text-[9px] uppercase text-slate-600">ボーナス投下月（複数選択可）</p>
              <input type="number" value={bonusAmount} onChange={(e)=>setBonusAmount(+e.target.value)} step={50000}
                className="w-36 rounded-xl border border-white/[0.10] bg-white/[0.04] px-2 py-1 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]"
                placeholder="金額（円）"/>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MONTH_NAMES.map((n, i) => (
                <button key={i} onClick={()=>toggleBonus(i)}
                  className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] transition-colors ${
                    bonusMonths.has(i) ? "border-amber-400/40 bg-amber-400/[0.12] text-amber-400" : "border-white/[0.10] text-slate-600 hover:text-slate-400"
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━ 資産配分 ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">資産配分（最大3銘柄）</p>
          <div className="flex items-center gap-3">
            <span className={`font-mono text-xs ${pctOk ? "text-[#34d399]" : "text-[#f87171]"}`}>
              合計 {totalPct.toFixed(0)}%{!pctOk && " ← 100%にする"}
            </span>
            {assets.length < 3 && (
              <button onClick={addAsset}
                className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1 font-mono text-[10px] text-slate-400 hover:bg-white/[0.08] transition-colors">
                + 銘柄追加
              </button>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {assets.map((a, ai) => (
            <div key={a.id} className="rounded-2xl border border-white/[0.10] bg-white/[0.03] p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-sm shrink-0" style={{backgroundColor: ASSET_COLORS[ai]}} />
                <select value={PRESETS.findIndex(p=>p.name===a.name)} onChange={(e)=>{
                  const pr = PRESETS[+e.target.value];
                  setAssets(prev=>prev.map(x=>x.id===a.id?{...x,...pr}:x));
                }} className="flex-1 rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-1.5 font-mono text-xs text-slate-200 outline-none">
                  {PRESETS.map((p,i)=><option key={i} value={i}>{p.name}</option>)}
                </select>
                {assets.length > 1 && (
                  <button onClick={()=>removeAsset(a.id)} className="font-mono text-[10px] text-slate-700 hover:text-[#f87171] transition-colors px-1">✕</button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label className="space-y-0.5">
                  <p className="font-mono text-[9px] uppercase text-slate-600">配分%</p>
                  <input type="number" value={a.pct} onChange={(e)=>updateAsset(a.id,"pct",+e.target.value)} step={5} min={0} max={100}
                    className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]"/>
                </label>
                <label className="space-y-0.5">
                  <p className="font-mono text-[9px] uppercase text-slate-600">
                    年率リターン%
                    {(a.totalRet === 10.4 || a.totalRet === 13.8) && (
                      <span className="ml-1 text-slate-700 normal-case">
                        {a.totalRet === 10.4 && "← DCA基準"}
                        {a.totalRet === 13.8 && "← QQQ長期平均"}
                      </span>
                    )}
                  </p>
                  <input type="number" value={a.totalRet} onChange={(e)=>updateAsset(a.id,"totalRet",+e.target.value)} step={0.5}
                    className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]"/>
                  {a.totalRet === 10.4 && (
                    <p className="font-mono text-[8px] text-slate-700 leading-3">
                      <TermTooltip term="phi2">phi2シグナル</TermTooltip>適用なら <button className="text-[#38bdf8] hover:underline" onClick={()=>updateAsset(a.id,"totalRet",12.7)}>12.7%に変更 →</button>
                    </p>
                  )}
                </label>
                <label className="space-y-0.5">
                  <p className="font-mono text-[9px] uppercase text-slate-600">配当利回り%</p>
                  <input type="number" value={a.divYield} onChange={(e)=>updateAsset(a.id,"divYield",+e.target.value)} step={0.1} min={0}
                    className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-2 py-1.5 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]"/>
                </label>
                <label className="space-y-0.5">
                  <p className="font-mono text-[9px] uppercase text-slate-600">配当</p>
                  <button onClick={()=>updateAsset(a.id,"drip",!a.drip)}
                    className={`w-full rounded-xl border px-2 py-1.5 font-mono text-[10px] transition-colors ${
                      a.drip ? "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]" : "border-amber-400/40 bg-amber-400/[0.08] text-amber-400"
                    }`}>
                    {a.drip ? "再投資（DRIP）" : "現金受取"}
                  </button>
                </label>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━ NISA設定 ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">NISA設定</p>
        <div className="flex gap-2 flex-wrap">
          {([["new","新NISA（非課税）"],["both","NISA＋課税口座"],["taxable","課税口座のみ"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setNisaMode(v)}
              className={`rounded-xl border px-4 py-2 font-mono text-xs transition-colors ${
                nisaMode===v ? "border-[#38bdf8]/40 bg-[#38bdf8]/[0.10] text-[#38bdf8]" : "border-white/[0.10] text-slate-500 hover:text-slate-300"
              }`}>{l}</button>
          ))}
        </div>
        {nisaMode !== "taxable" && (
          <p className="mt-2 font-mono text-[10px] text-slate-600">
            新NISA生涯上限 1,800万円 · 年間上限 360万円。NISA枠が埋まった後は課税口座へ。
          </p>
        )}
      </section>

      {/* ━━ 取り崩し設定 ━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <div className="flex items-center gap-3 mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">取り崩しフェーズ</p>
          <button onClick={()=>setEnableDecum(v=>!v)}
            className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-colors ${
              enableDecum ? "border-[#34d399]/40 bg-[#34d399]/[0.10] text-[#34d399]" : "border-white/[0.10] text-slate-600 hover:text-slate-400"
            }`}>
            {enableDecum ? "ON" : "OFF — 積立のみ"}
          </button>
        </div>
        {enableDecum && (
          <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="space-y-1">
                <p className="font-mono text-[9px] uppercase text-slate-600">取り崩し期間（年）</p>
                <input type="number" value={decumYears} onChange={(e)=>setDecumYears(Math.max(1,+e.target.value))} step={5}
                  className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
              </label>
              <label className="space-y-1">
                <p className="font-mono text-[9px] uppercase text-slate-600">方式</p>
                <select value={withdrawMode} onChange={(e)=>setWithdrawMode(e.target.value as typeof withdrawMode)}
                  className="w-full rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-2 font-mono text-xs text-slate-200 outline-none">
                  <option value="4pct">4%ルール（積立額の4%/年）</option>
                  <option value="fixed">固定額</option>
                  <option value="yield">配当のみ（元本を減らさない）</option>
                </select>
              </label>
              {withdrawMode === "fixed" && (
                <label className="space-y-1">
                  <p className="font-mono text-[9px] uppercase text-slate-600">月額取り崩し（円）</p>
                  <input type="number" value={fixedMonthly} onChange={(e)=>setFixedMonthly(+e.target.value)} step={10000}
                    className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
                </label>
              )}
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-2">
              <p className="text-xs text-amber-400/80">
                取り崩しは<strong className="text-amber-400">課税口座→NISA</strong>の順で行います。課税口座が尽きた後にNISA（非課税）を使用。
                {nisaMode !== "taxable" && " NISA枠での取り崩しは非課税（1800万枠は取り崩し後に翌年回復）。"}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* ━━ シナリオ ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">シナリオ</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {([
            ["base",  "期待値（平均）"],
            ["bear",  "弱気（−3%/年）"],
            ["crash", "暴落シナリオ"],
            ["hist",  "SP500実績を当てはめ"],
          ] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setScenario(v)}
              className={`rounded-xl border px-3 py-1.5 font-mono text-[10px] transition-colors ${
                scenario===v ? "border-[#38bdf8]/40 bg-[#38bdf8]/[0.10] text-[#38bdf8]" : "border-white/[0.10] text-slate-500 hover:text-slate-300"
              }`}>{l}</button>
          ))}
        </div>
        {scenario === "crash" && (
          <div className="flex items-center gap-3">
            <p className="font-mono text-[9px] uppercase text-slate-600">暴落発生年（積立開始から）</p>
            <input type="number" value={crashYear} onChange={(e)=>setCrashYear(Math.max(1,+e.target.value))} min={1} max={accumYears}
              className="w-24 rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-slate-200 outline-none focus:border-white/[0.25]"/>
            <p className="font-mono text-[10px] text-slate-600">年目に −40%（GFC相当）</p>
          </div>
        )}
        {scenario === "hist" && (
          <div className="flex items-center gap-3">
            <p className="font-mono text-[9px] uppercase text-slate-600">開始年</p>
            <select value={histStart} onChange={(e)=>setHistStart(+e.target.value)}
              className="rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-1.5 font-mono text-xs text-slate-200 outline-none">
              {HIST_YRS.map(y=><option key={y} value={y}>{y}年〜（{y}=+{((SP500_HIST[y]??0)*100).toFixed(1)}%）</option>)}
            </select>
            <p className="font-mono text-[10px] text-slate-600">SP500の実際の年次リターン配列を使用。枠外は循環。</p>
          </div>
        )}
        {scenario === "bear" && (
          <p className="font-mono text-[10px] text-slate-600">設定リターンから毎年3%引く。低成長・デフレシナリオの確認用。</p>
        )}
      </section>

      {/* ━━ 結果サマリー ━━━━━━━━━━━━━━━━━━━━ */}
      {last && (() => {
        const noBonusLast  = noBonusData[noBonusData.length - 1];
        const uniformLast  = uniformData[uniformData.length - 1];
        const bonusEffect  = last.portfolio - noBonusLast.portfolio;   // ボーナス資金の貢献
        const timingEffect = last.portfolio - uniformLast.portfolio;   // 投入タイミングの貢献（±）
        const totalBonus   = bonusAmount * bonusMonths.size * accumYears;
        const bonusRoi     = totalBonus > 0 ? bonusEffect / totalBonus : 0; // ボーナス資金の増殖率

        return (
        <section>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
            {enableDecum ? `${accumYears}年積立→${decumYears}年取り崩しの試算` : `${accumYears}年後の試算`}
          </p>

          {/* 4メインカード */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { l:"総投資元本",   v:fMan(last.invested),    c:"text-slate-400",  s:"累計投入額" },
              { l:"最終資産",     v:fMan(last.portfolio),   c:"text-[#34d399]",  s:"税引前" },
              { l:"税引後",       v:fMan(last.afterTax),    c:"text-[#e8f4ff]",  s:nisaMode==="new"?"NISA非課税":"課税後(20.315%)" },
              { l:"vs 元本",      v:`×${(last.portfolio/Math.max(last.invested,1)).toFixed(1)}`,c:"text-[#38bdf8]",s:"何倍になったか" },
            ].map(c=>(
              <div key={c.l} className="rounded-2xl border border-white/[0.10] bg-white/[0.04] px-4 py-3 text-center">
                <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">{c.l}</p>
                <p className={`font-mono text-xl font-bold mt-0.5 ${c.c}`}>{c.v}</p>
                <p className="font-mono text-[9px] text-slate-700 mt-0.5">{c.s}</p>
              </div>
            ))}
          </div>

          {/* ━ 資金効果の内訳 ━━━━━━━━━━━━━━━━━━━━━ */}
          {bonusMonths.size > 0 && (
            <div className="mt-3 rounded-2xl border border-white/[0.12] bg-white/[0.03] p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                資金効果の内訳 — 「追加投入分でどれだけ増えるか」
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">

                {/* 月次DCAのみ */}
                <div className="rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-3">
                  <p className="font-mono text-[9px] uppercase text-slate-600">月次DCAのみ（ボーナスなし）</p>
                  <p className="font-mono text-base font-bold text-slate-300 mt-1">{fMan(noBonusLast.portfolio)}</p>
                  <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                    元本 {fMan(noBonusLast.invested)} → ×{(noBonusLast.portfolio/Math.max(noBonusLast.invested,1)).toFixed(1)}
                  </p>
                </div>

                {/* ボーナス追加の貢献 */}
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-3 py-3">
                  <p className="font-mono text-[9px] uppercase text-amber-400/70">ボーナス追加投入の貢献</p>
                  <p className="font-mono text-base font-bold text-amber-400 mt-1">+{fMan(bonusEffect)}</p>
                  <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                    ボーナス総投入額 {fMan(totalBonus)} が
                    {totalBonus > 0 ? `×${(1 + bonusRoi).toFixed(2)}に増殖` : "なし"}
                  </p>
                  <p className="font-mono text-[9px] text-slate-700 mt-1">
                    ↑ これが「追加投入してるから当然高い」分
                  </p>
                </div>

                {/* タイミング効果 */}
                <div className={`rounded-xl border px-3 py-3 ${
                  timingEffect > 0
                    ? "border-[#34d399]/20 bg-[#34d399]/[0.04]"
                    : "border-white/[0.10] bg-white/[0.03]"
                }`}>
                  <p className="font-mono text-[9px] uppercase text-slate-600">
                    投入タイミングの効果
                    <span className="ml-1 text-slate-700">（同額均等配分との比較）</span>
                  </p>
                  <p className={`font-mono text-base font-bold mt-1 ${
                    timingEffect > 0 ? "text-[#34d399]" : timingEffect < 0 ? "text-[#f87171]" : "text-slate-400"
                  }`}>
                    {timingEffect > 0 ? "+" : ""}{fMan(timingEffect)}
                  </p>
                  <p className="font-mono text-[9px] text-slate-600 mt-0.5">
                    同額を毎月均等投入した場合: {fMan(uniformLast.portfolio)}
                  </p>
                  <p className="font-mono text-[9px] text-slate-700 mt-1">
                    {timingEffect > 0
                      ? "↑ ボーナス月に集中投入することで複利を多く得た分"
                      : timingEffect < 0
                      ? "↑ 均等配分の方がわずかに有利（月次分散効果）"
                      : "タイミング効果なし（均等と同等）"}
                  </p>
                </div>
              </div>

              <p className="mt-2 font-mono text-[9px] text-slate-700 leading-5">
                ※「タイミング効果」はシグナルによるリターン率アップを含まない。シグナル（phi2等）でリターン率が上がる場合は、
                上の年率リターン欄を変えて比較してください（例: VOO 10.4% → phi2適用後 12.7%）。
              </p>
            </div>
          )}

          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {/* NISA進捗 */}
            {nisaMode !== "taxable" && endAccum && (
              <div className="rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-4 py-3">
                <p className="font-mono text-[9px] uppercase text-[#38bdf8]/70">NISA枠進捗</p>
                <p className="font-mono text-lg font-bold text-[#38bdf8] mt-0.5">{fMan(endAccum.nisaProgress)}<span className="text-xs font-normal text-slate-500"> / 1800万</span></p>
                <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/[0.06]">
                  <div className="h-1.5 rounded-full bg-[#38bdf8]/60" style={{width:`${Math.min(100,endAccum.nisaProgress/180000)}%`}}/>
                </div>
              </div>
            )}
            {/* 4%ルール */}
            {endAccum && (
              <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.05] px-4 py-3">
                <p className="font-mono text-[9px] uppercase text-[#34d399]/70">取り崩し可能額（4%ルール）</p>
                <p className="font-mono text-lg font-bold text-[#34d399] mt-0.5">{fYen(endAccum.safe4pct)}<span className="text-xs font-normal text-slate-500">/月</span></p>
                <p className="font-mono text-[9px] text-slate-600">{accumYears}年後の資産×4%÷12</p>
              </div>
            )}
            {/* 配当収入 */}
            {endAccum && (
              <div className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
                <p className="font-mono text-[9px] uppercase text-amber-400/70">{accumYears}年後の年間現金配当</p>
                <p className="font-mono text-lg font-bold text-amber-400 mt-0.5">{fMan(endAccum.divCash)}</p>
                <p className="font-mono text-[9px] text-slate-600">DRIP=OFFの銘柄からの現金配当</p>
              </div>
            )}
          </div>
        </section>
        );
      })()}

      {/* ━━ チャート ━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">資産推移</p>
          <div className="flex gap-1">
            {([["wealth","資産"],["dividend","配当・取崩"]] as const).map(([v,l])=>(
              <button key={v} onClick={()=>setChartMode(v)}
                className={`rounded-xl border px-3 py-1 font-mono text-[10px] transition-colors ${
                  chartMode===v?"border-[#38bdf8]/40 bg-[#38bdf8]/[0.10] text-[#38bdf8]":"border-white/[0.10] text-slate-500 hover:text-slate-300"
                }`}>{l}</button>
            ))}
          </div>
        </div>
        <div className="h-64 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-3">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{top:4,right:8,bottom:0,left:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="label" tick={{fill:"#64748b",fontSize:10,fontFamily:"ui-monospace,monospace"}} axisLine={false} tickLine={false}/>
              <YAxis tickFormatter={fMan} tick={{fill:"#64748b",fontSize:10,fontFamily:"ui-monospace,monospace"}} axisLine={false} tickLine={false} width={56}/>
              <Tooltip content={<ChartTip/>}/>
              <Legend formatter={(v)=><span className="font-mono text-[10px] text-slate-400">{v}</span>}/>
              {chartMode === "wealth" && <>
                <Area type="monotone" dataKey="invested"    name="元本"              stroke="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.03)" strokeWidth={1} strokeDasharray="4 2" dot={false}/>
                {bonusMonths.size > 0 && <Area type="monotone" dataKey="noBonusPf"  name="月次DCAのみ"           stroke="#64748b" fill="transparent" strokeWidth={1.5} strokeDasharray="5 3" dot={false}/>}
                {bonusMonths.size > 0 && <Area type="monotone" dataKey="uniformPf"  name="同額均等配分"           stroke="#f59e0b" fill="transparent" strokeWidth={1}  strokeDasharray="3 3" dot={false}/>}
                {nisaMode !== "taxable" && <Area type="monotone" dataKey="nisa"     name="NISA"                  stroke="#38bdf8" fill="#38bdf840" strokeWidth={1.5} dot={false}/>}
                <Area type="monotone" dataKey="portfolio"   name="現在の設定"         stroke="#34d399" fill="#34d39920" strokeWidth={2.5} dot={false}/>
              </>}
              {chartMode === "dividend" && <>
                <Bar dataKey="divCash"    name="年間現金配当" fill="#f59e0b60" radius={2}/>
                {enableDecum && <Bar dataKey="withdrawal" name="年間取り崩し" fill="#f8717160" radius={2}/>}
                <Area type="monotone" dataKey="safe4pct" name="4%月額" stroke="#34d399" fill="transparent" strokeWidth={1.5} dot={false}/>
              </>}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {bonusMonths.size > 0 && chartMode === "wealth" && (
          <div className="mt-2 flex flex-wrap gap-3 font-mono text-[9px] text-slate-600">
            <span><span className="text-[#34d399]">━</span> 現在の設定（月次+ボーナス）</span>
            <span><span className="text-amber-400">┅</span> 同額均等配分（同じ総資金を毎月均等）</span>
            <span><span className="text-slate-400">╌</span> 月次DCAのみ（ボーナスなし）</span>
            <span><span className="text-white/30">╌</span> 元本（累計投入額）</span>
          </div>
        )}
      </section>

      {/* ━━ 年次テーブル ━━━━━━━━━━━━━━━━━━━━━ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">年次推移</p>
          <button onClick={()=>setShowAllYears(v=>!v)} className="font-mono text-[10px] text-slate-500 hover:text-slate-300 transition-colors">
            {showAllYears ? "5年ごとに戻す" : "全年表示"}
          </button>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.12]">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="border-b border-white/[0.10] bg-white/[0.05]">
              <tr>
                {["年",nisaMode!=="taxable"?"NISA":"",nisaMode!=="taxable"?"課税":"","資産合計","税引後","元本","年間配当",enableDecum?"年間取崩":"4%月額"].filter(Boolean).map(h=>(
                  <th key={h} className="px-3 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableData.map((d)=>{
                const isRetire = enableDecum && d.year === accumYears;
                return (
                  <tr key={d.year} className={`border-t border-white/[0.08] hover:bg-white/[0.03] ${isRetire ? "bg-[#34d399]/[0.04]" : ""}`}>
                    <td className={`px-3 py-2.5 font-mono text-xs ${isRetire?"text-[#34d399]":"text-slate-400"}`}>
                      {d.label}{isRetire?" ⬅ 積立終了":""}
                    </td>
                    {nisaMode!=="taxable" && <td className="px-3 py-2.5 font-mono text-xs text-[#38bdf8]">{fMan(d.nisa)}</td>}
                    {nisaMode!=="taxable" && <td className="px-3 py-2.5 font-mono text-xs text-slate-500">{fMan(d.taxable)}</td>}
                    <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#34d399]">{fMan(d.portfolio)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#e8f4ff]">{fMan(d.afterTax)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-slate-600">{fMan(d.invested)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-amber-400">{fMan(d.divCash)}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[#34d399]">
                      {enableDecum && d.year > accumYears ? fYen(d.withdrawal/12) : fYen(d.safe4pct)}
                      <span className="text-slate-700">/月</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ━━ このページの用語・根拠 ━━━━━━━━━━━━━━━━━━ */}
      <QuickRef
        terms={["dca","phi2","crs","drip","rule4pct","nisa","efa"]}
        relatedPages={[
          { label: "/signal — シグナル",   href: "/signal",   note: "今日の発動状態とCRSスコア" },
          { label: "/research — 検証書庫", href: "/research", note: "年率12.7%の根拠・バックテスト" },
          { label: "/glossary — 用語集",   href: "/glossary", note: "DCA・DRIP・4%ルールの完全定義" },
        ]}
      />

      {/* ━━ 免責 ━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="rounded-xl border border-white/[0.08] px-4 py-3">
        <ul className="space-y-0.5 font-mono text-[10px] leading-5 text-slate-700">
          <li>· 年率リターンはプリセット値（公開データの長期幾何平均）。実際のリターンは変動します</li>
          <li>· NISA取り崩し時の1800万枠回復は翌年。本シミュレーションは枠回復の再利用は考慮外</li>
          <li>· 課税計算は「最終時点での未実現益×20.315%」として簡易計算（毎年の確定申告は考慮外）</li>
          <li>· 4%ルール: 積立終了時の資産×4%÷12を月額取り崩しと定義。インフレ調整なし</li>
          <li>· 配当は現地課税（米国株10%）を考慮していません。実際の手取りはやや低くなります</li>
          <li>· これは投資助言ではありません。最終判断はご自身でお願いします</li>
        </ul>
      </div>
    </div>
  );
}
