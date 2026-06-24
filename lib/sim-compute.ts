/**
 * CSV から phi2 シグナルと DCA vs phi2 シミュレーションを計算する（サーバーサイド専用）
 * ファイルを読む → 計算する → 結果を返す。外部APIコールなし。
 */

import fs from "fs";
import path from "path";

// ── CSV パーサ ─────────────────────────────────────────────────────────────

function readCsv(file: string): Map<string, number> {
  const p = path.join(process.cwd(), "engine", "data", file);
  if (!fs.existsSync(p)) return new Map();
  const txt = fs.readFileSync(p, "utf8");
  const map = new Map<string, number>();
  for (const line of txt.split("\n").slice(1)) {
    const parts = line.trim().split(",");
    if (parts.length < 2) continue;
    const d = parts[0].trim();
    const v = parseFloat(parts[1]);
    if (d && !isNaN(v)) map.set(d, v);
  }
  return map;
}

// ── 出力型 ──────────────────────────────────────────────────────────────────

export interface Phi2Signal {
  date: string;     // YYYY-MM-DD
  price: number;    // SP500 価格
  crs: number;      // CRS スコア (0-6)
  athDd: number;    // ATH 乖離率
}

export interface SimMonthly {
  date: string;      // YYYY-MM（グラフ X軸表示用）
  dateRaw: string;   // YYYY-MM-DD（実際の日付）
  dca: number;       // DCA 戦略ポートフォリオ価値（初月=100 に正規化）
  phi2: number;      // phi2 戦略ポートフォリオ価値（初月=100 に正規化）
  sp500: number;     // SP500 価格（初月=100 に正規化）
  signalFired: boolean;
}

export interface Sp500Point {
  date: string;   // YYYY-MM-DD
  price: number;
  signal: boolean;
  crs: number;
}

// ── メイン計算 ───────────────────────────────────────────────────────────────

export interface SimResult {
  monthly: SimMonthly[];
  signals: Phi2Signal[];
  totalSignals: number;
  signalsPerYear: number;
  dcaFinal: number;
  phi2Final: number;
  alpha: number;  // phi2 - dca の最終差分（%pt）
}

export function computeSimulation(): SimResult {
  const sp500 = readCsv("sp500_daily.csv");
  const vix   = readCsv("vix.csv");
  const hyg   = readCsv("hyg.csv");
  const dxy   = readCsv("dxy.csv");
  const rsp   = readCsv("rsp.csv");

  const dates = Array.from(sp500.keys()).sort();

  // HYG は 2007 から。余裕を持って 2008-01-01 以降で計算
  const START = "2008-01-01";
  const startIdx = dates.findIndex((d) => d >= START);
  if (startIdx < 0) return { monthly: [], signals: [], totalSignals: 0, signalsPerYear: 0, dcaFinal: 100, phi2Final: 100, alpha: 0 };

  const sp500Start = sp500.get(dates[startIdx])!;

  // ── ポートフォリオ状態 ──────────────────────────────────────────────────
  const MONTHLY = 100;   // 月次積立額（正規化用）
  const SIGNAL_EXTRA = 300; // シグナル時の追加投入額（月次の3倍）

  let dcaShares  = 0;
  let phi2Shares = 0;
  let lastMonth  = "";

  let ath = sp500Start;
  let athIdx = startIdx;

  const monthly: SimMonthly[] = [];
  const signals: Phi2Signal[] = [];

  for (let i = startIdx; i < dates.length; i++) {
    const d     = dates[i];
    const price = sp500.get(d)!;

    // ATH 更新
    if (price > ath) { ath = price; athIdx = i; }

    const ageAth = i - athIdx;
    const athDd  = price / ath - 1;

    // 月次積立（月の最初の営業日）
    const month = d.slice(0, 7);
    if (month !== lastMonth) {
      lastMonth = month;
      dcaShares  += MONTHLY / price;
      phi2Shares += MONTHLY / price;
    }

    // 日次リターン
    const prevPrice = i > 0 ? sp500.get(dates[i - 1])! : price;
    const dayRet = price / prevPrice - 1;

    // vol20（20日年率ボラ）
    let vol20 = 0;
    if (i - startIdx >= 20) {
      const slice = dates.slice(i - 20, i + 1).map((dd) => sp500.get(dd)!);
      const rets  = slice.slice(1).map((v, j) => Math.log(v / slice[j]));
      const mean  = rets.reduce((a, b) => a + b, 0) / rets.length;
      const vrn   = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
      vol20 = Math.sqrt(vrn * 252);
    }

    // CRS 6成分
    const vixVal  = vix.get(d) ?? 0;
    const c1      = vixVal > 30;

    const hygNow  = hyg.get(d);
    const hyg3d   = i >= 3 ? hyg.get(dates[i - 3]) : undefined;
    const c2      = hygNow !== undefined && hyg3d !== undefined && hygNow < hyg3d;

    const dxyNow  = dxy.get(d);
    const dxy5d   = i >= 5 ? dxy.get(dates[i - 5]) : undefined;
    const c3      = dxyNow !== undefined && dxy5d !== undefined && dxyNow > dxy5d;

    const c4 = ageAth <= 90;

    // HYG 60日高値乖離
    let hyg60hi = -Infinity;
    for (let j = Math.max(startIdx, i - 60); j <= i; j++) {
      const h = hyg.get(dates[j]);
      if (h !== undefined && h > hyg60hi) hyg60hi = h;
    }
    const c5 = hygNow !== undefined && hyg60hi > 0 && hygNow / hyg60hi - 1 <= -0.08;

    // RSP vs SP500 5日相対
    const rspNow  = rsp.get(d);
    const rsp5d   = i >= 5 ? rsp.get(dates[i - 5]) : undefined;
    const sp5d    = i >= 5 ? sp500.get(dates[i - 5]) : undefined;
    const c6      = rspNow !== undefined && rsp5d !== undefined && sp5d !== undefined &&
                    (rspNow / rsp5d - 1) < (price / sp5d - 1);

    const crs = [c1, c2, c3, c4, c5, c6].filter(Boolean).length;

    // phi2 v3 判定
    const ageAthOk = !(ageAth >= 91 && ageAth <= 252);
    const phi2Active =
      athDd <= -0.10 &&
      dayRet <= -0.02 &&
      vol20 > 0.25 &&
      ageAthOk &&
      crs >= 2;

    if (phi2Active) {
      phi2Shares += SIGNAL_EXTRA / price;
      signals.push({ date: d, price, crs, athDd });
    }

    // 月次スナップショット（月の最終日付で記録 = 翌月に変わる直前）
    const nextMonth = i + 1 < dates.length ? dates[i + 1].slice(0, 7) : "";
    if (nextMonth !== month || i === dates.length - 1) {
      monthly.push({
        date:        month,
        dateRaw:     d,
        dca:         dcaShares * price,
        phi2:        phi2Shares * price,
        sp500:       (price / sp500Start) * 100,
        signalFired: phi2Active,
      });
    }
  }

  // ── 正規化：初月の DCA 価値を 100 とする ─────────────────────────────────
  const base = monthly[0]?.dca ?? 1;
  for (const m of monthly) {
    m.dca  = (m.dca  / base) * 100;
    m.phi2 = (m.phi2 / base) * 100;
  }

  const dcaFinal  = monthly[monthly.length - 1]?.dca  ?? 100;
  const phi2Final = monthly[monthly.length - 1]?.phi2 ?? 100;
  const years = (dates.length - startIdx) / 252;

  return {
    monthly,
    signals,
    totalSignals:   signals.length,
    signalsPerYear: Math.round((signals.length / years) * 10) / 10,
    dcaFinal,
    phi2Final,
    alpha: phi2Final - dcaFinal,
  };
}

// ── SP500 直近 180 日の価格（グラフ用） ────────────────────────────────────
// signal ページは Supabase から取る。これはフォールバック用。

export function getRecentSp500(): Sp500Point[] {
  const sp500 = readCsv("sp500_daily.csv");
  const dates = Array.from(sp500.keys()).sort().slice(-180);

  let ath = 0;
  let athIdx = 0;
  for (let i = 0; i < dates.length; i++) {
    const v = sp500.get(dates[i])!;
    if (v > ath) { ath = v; athIdx = i; }
  }

  const vix = readCsv("vix.csv");
  const hyg = readCsv("hyg.csv");
  const dxy = readCsv("dxy.csv");
  const rsp = readCsv("rsp.csv");

  const result: Sp500Point[] = [];
  const allDates = Array.from(sp500.keys()).sort();
  const startGlobal = allDates.length - 180;

  let globalAth = 0;
  let globalAthIdx = 0;
  for (let i = 0; i < allDates.length - 180; i++) {
    const v = sp500.get(allDates[i])!;
    if (v > globalAth) { globalAth = v; globalAthIdx = i; }
  }

  for (let i = 0; i < dates.length; i++) {
    const d    = dates[i];
    const gi   = startGlobal + i;
    const price = sp500.get(d)!;

    if (price > globalAth) { globalAth = price; globalAthIdx = gi; }
    const ageAth = gi - globalAthIdx;
    const athDd  = price / globalAth - 1;

    const prevPrice = i > 0 ? sp500.get(dates[i - 1])! : price;
    const dayRet = price / prevPrice - 1;

    let vol20 = 0.3; // default
    if (i >= 20) {
      const slice = dates.slice(i - 20, i + 1).map((dd) => sp500.get(dd)!);
      const rets  = slice.slice(1).map((v2, j) => Math.log(v2 / slice[j]));
      const mean  = rets.reduce((a, b) => a + b, 0) / rets.length;
      const vrn   = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
      vol20 = Math.sqrt(vrn * 252);
    }

    const vixVal = vix.get(d) ?? 0;
    const c1 = vixVal > 30;

    const hygNow = hyg.get(d);
    const hyg3d  = i >= 3 ? hyg.get(dates[i - 3]) : undefined;
    const c2 = hygNow !== undefined && hyg3d !== undefined && hygNow < hyg3d;

    const dxyNow = dxy.get(d);
    const dxy5d  = i >= 5 ? dxy.get(dates[i - 5]) : undefined;
    const c3 = dxyNow !== undefined && dxy5d !== undefined && dxyNow > dxy5d;

    const c4 = ageAth <= 90;

    let hyg60hi = -Infinity;
    for (let j = Math.max(0, i - 60); j <= i; j++) {
      const h = hyg.get(dates[j]);
      if (h !== undefined && h > hyg60hi) hyg60hi = h;
    }
    const c5 = hygNow !== undefined && hyg60hi > 0 && hygNow / hyg60hi - 1 <= -0.08;

    const rspNow = rsp.get(d);
    const rsp5d  = i >= 5 ? rsp.get(dates[i - 5]) : undefined;
    const sp5d   = i >= 5 ? sp500.get(dates[i - 5]) : undefined;
    const c6 = rspNow !== undefined && rsp5d !== undefined && sp5d !== undefined &&
               (rspNow / rsp5d - 1) < (price / sp5d - 1);

    const crs = [c1, c2, c3, c4, c5, c6].filter(Boolean).length;
    const ageAthOk = !(ageAth >= 91 && ageAth <= 252);
    const signal = athDd <= -0.10 && dayRet <= -0.02 && vol20 > 0.25 && ageAthOk && crs >= 2;

    result.push({ date: d, price: Math.round(price), signal, crs });
  }

  return result;
}
