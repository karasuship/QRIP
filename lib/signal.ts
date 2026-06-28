export interface CRSComponents {
  c1: boolean; // VIX > 30
  c2: boolean; // HYG 3日落
  c3: boolean; // DXY 5日上昇
  c4: boolean; // age_ath <= 90
  c5: boolean; // HYG 60日高値-8%以下
  c6: boolean; // RSP 5日リターン < SP500比
}

export interface TriggerDay {
  date: string;
  dayRet: number;
  athDd: number;
  ageAth: number;
  vol20: number;
  crs: number | null;
  phi2v3: boolean;
}

export interface PastEpisode {
  date: string;
  athDd: number;
  dayRet: number;
  vol20: number;
  retToDate: number;
  daysAgo: number;
}

export interface SignalData {
  date: string;
  price: number;
  ath: number;
  athDd: number;
  ageAth: number;
  ageAthOk: boolean;
  vol20: number | null;
  dayRet: number | null;
  rsi14: number | null;
  vix: number | null;
  crs: number;
  crsComponents: CRSComponents;
  // メインシグナル
  phi2Active: boolean;
  rsi25Active: boolean;
  rsi25Crossunder: boolean;
  // 追加シグナル
  hygSignal: boolean;       // HYG-8% QE後 (decisions/0016)
  b4Active: boolean;        // phi2後7日追加投入 (decisions/0018)
  b4BaseDate: string | null;
  // グローバル
  efaAthDd: number | null;
  efaActive: boolean;
  eemAthDd: number | null;
  eemActive: boolean;
  // ナスダック100 (decisions/0036, Round 48)
  qqqAthDd: number | null;
  qqqActive: boolean;
  // 全世界株 オルカン / VT (decisions/0036, Round 49)
  vtAthDd: number | null;
  vtActive: boolean;
  signalTier: "NONE" | "NEAR" | "PHI2" | "RSI25" | "DOUBLE";
  history: TriggerDay[];
  pastEpisodes: PastEpisode[];
  // 日本株（個別）decisions/0033
  jpSignals: import("@/lib/jp-stock-signal").JpStockSignal[];
}

type Nullable<T> = T | null;

async function fetchTicker(
  ticker: string,
  range = "6mo"
): Promise<[string[], number[]] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
      },
      next: { revalidate: 900 },
    });
    if (!res.ok) {
      console.error(`[signal] fetch ${ticker} → HTTP ${res.status}`);
      return null;
    }
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const ts: number[] = result.timestamp ?? [];
    const raw: Nullable<number>[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];

    const dates: string[] = [];
    const vals: number[] = [];
    for (let i = 0; i < ts.length; i++) {
      const v = raw[i];
      if (v !== null && v !== undefined && !isNaN(v)) {
        dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
        vals.push(v);
      }
    }
    return [dates, vals];
  } catch {
    return null;
  }
}

function wilderRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  return 100 - 100 / (1 + avgGain / avgLoss);
}

function annualVol20(closes: number[], endIdx: number): number | null {
  if (endIdx < 20) return null;
  const rets: number[] = [];
  for (let k = 0; k < 20; k++) {
    rets.push(Math.log(closes[endIdx - k] / closes[endIdx - k - 1]));
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance =
    rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

// Binary search: last index where dates[idx] <= target
function dateFloor(dates: string[], target: string): number {
  let lo = 0,
    hi = dates.length - 1,
    ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= target) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

function computeCRS(params: {
  date: string;
  vixDates: string[];
  vixVals: number[];
  hygDates: string[];
  hygVals: number[];
  dxyDates: string[];
  dxyVals: number[];
  rspDates: string[];
  rspVals: number[];
  spDates: string[];
  spVals: number[];
  ageAth: number;
}): { crs: number; components: CRSComponents } {
  const { date, vixDates, vixVals, hygDates, hygVals, dxyDates, dxyVals,
          rspDates, rspVals, spDates, spVals, ageAth } = params;

  const vi = dateFloor(vixDates, date);
  const c1 = vi >= 0 && vixVals[vi] > 30;

  const hi = dateFloor(hygDates, date);
  const c2 = hi >= 3 && (hygVals[hi] / hygVals[hi - 3] - 1) <= 0;

  const di = dateFloor(dxyDates, date);
  const c3 = di >= 5 && (dxyVals[di] / dxyVals[di - 5] - 1) >= 0;

  const c4 = ageAth <= 90;

  const c5 =
    hi >= 60 &&
    hygVals[hi] / Math.max(...hygVals.slice(hi - 60, hi + 1)) - 1 <= -0.08;

  const ri = dateFloor(rspDates, date);
  const si = dateFloor(spDates, date);
  const rspRet = ri >= 5 ? rspVals[ri] / rspVals[ri - 5] - 1 : null;
  const spRet = si >= 5 ? spVals[si] / spVals[si - 5] - 1 : null;
  const c6 = rspRet !== null && spRet !== null && rspRet < spRet;

  const components: CRSComponents = { c1, c2, c3, c4, c5, c6 };
  const crs = [c1, c2, c3, c4, c5, c6].filter(Boolean).length;
  return { crs, components };
}

// EFA/EEM など グローバル ETF の phi2 v3 条件チェック（CRS は SP500 ベース）
function computeGlobalPhi2(
  vals: number[],
  crs: number,
  athThr = -0.1   // ATH 乖離閾値（QQQ は -0.18 を指定）
): { athDd: number; active: boolean } {
  if (vals.length < 30) return { athDd: 0, active: false };
  const n = vals.length;
  let ath = vals[0], athIdx = 0;
  for (let i = 1; i < n; i++) {
    if (vals[i] > ath) { ath = vals[i]; athIdx = i; }
  }
  const athDd = vals[n - 1] / ath - 1;
  const ageAth = n - 1 - athIdx;
  const ageAthOk = !(ageAth >= 91 && ageAth <= 252);
  const dayRet = n >= 2 ? vals[n - 1] / vals[n - 2] - 1 : null;
  const vol20 = annualVol20(vals, n - 1);
  const active =
    athDd <= athThr &&
    dayRet !== null && dayRet <= -0.02 &&
    vol20 !== null && vol20 > 0.25 &&
    ageAthOk &&
    crs >= 2;
  return { athDd, active };
}

export async function fetchSignal(): Promise<SignalData> {
  const { fetchJpStockSignals } = await import("@/lib/jp-stock-signal");

  const [spResult, vixResult, hygResult, dxyResult, rspResult, efaResult, eemResult, qqqResult, vtResult, jpSignals] =
    await Promise.all([
      fetchTicker("%5EGSPC", "2y"),
      fetchTicker("%5EVIX", "6mo").catch(() => null),
      fetchTicker("HYG", "6mo").catch(() => null),
      fetchTicker("DX-Y.NYB", "6mo").catch(() => null),
      fetchTicker("RSP", "6mo").catch(() => null),
      fetchTicker("EFA", "2y").catch(() => null),
      fetchTicker("EEM", "2y").catch(() => null),
      fetchTicker("QQQ", "2y").catch(() => null),
      fetchTicker("VT", "2y").catch(() => null),
      fetchJpStockSignals().catch(() => []),
    ]);

  if (!spResult) throw new Error("SP500データ取得失敗");
  const [spDates, spVals] = spResult;
  if (spVals.length < 30) throw new Error("SP500データ不足");

  const [vixDates, vixVals] = vixResult ?? [[], []];
  const [hygDates, hygVals] = hygResult ?? [[], []];
  const [dxyDates, dxyVals] = dxyResult ?? [[], []];
  const [rspDates, rspVals] = rspResult ?? [[], []];

  const n = spVals.length;

  // Running ATH + age
  const runningAth = new Array<number>(n);
  const runningAthIdx = new Array<number>(n);
  runningAth[0] = spVals[0];
  runningAthIdx[0] = 0;
  for (let i = 1; i < n; i++) {
    if (spVals[i] > runningAth[i - 1]) {
      runningAth[i] = spVals[i];
      runningAthIdx[i] = i;
    } else {
      runningAth[i] = runningAth[i - 1];
      runningAthIdx[i] = runningAthIdx[i - 1];
    }
  }

  const last = spVals[n - 1];
  const lastDate = spDates[n - 1];
  const ath = runningAth[n - 1];
  const athDd = last / ath - 1;
  const ageAth = n - 1 - runningAthIdx[n - 1];
  const ageAthOk = !(ageAth >= 91 && ageAth <= 252);

  const vol20 = annualVol20(spVals, n - 1);
  const dayRet = n >= 2 ? spVals[n - 1] / spVals[n - 2] - 1 : null;

  const rsiWindow = spVals.slice(Math.max(0, n - 100));
  const rsi14 = wilderRSI(rsiWindow);
  const prevRsi14 =
    n >= 2 ? wilderRSI(spVals.slice(Math.max(0, n - 101), n - 1)) : null;

  const vi = dateFloor(vixDates, lastDate);
  const vix = vi >= 0 ? vixVals[vi] : null;

  const { crs, components: crsComponents } = computeCRS({
    date: lastDate,
    vixDates, vixVals,
    hygDates, hygVals,
    dxyDates, dxyVals,
    rspDates, rspVals,
    spDates, spVals,
    ageAth,
  });

  const phi2Active =
    athDd <= -0.1 &&
    dayRet !== null && dayRet <= -0.02 &&
    vol20 !== null && vol20 > 0.25 &&
    ageAthOk &&
    crs >= 2;

  const rsi25Active = rsi14 !== null && rsi14 < 25;
  const rsi25Crossunder =
    rsi25Active && (prevRsi14 === null || prevRsi14 >= 25);

  // HYG-8% QE後シグナル (decisions/0016)
  // CRS C5 (HYG 60日-8%) が成立 AND ATH-5% 以上の下落
  const hygSignal = crsComponents.c5 && athDd <= -0.05;

  // B4: phi2が7営業日前に発動 AND 今日もATH-10%以下 (decisions/0018)
  let b4Active = false;
  let b4BaseDate: string | null = null;
  if (n >= 10 && athDd <= -0.1) {
    const b4Idx = n - 8; // 7営業日前
    if (b4Idx >= 1) {
      const b4Dr = spVals[b4Idx] / spVals[b4Idx - 1] - 1;
      const b4Dd = spVals[b4Idx] / runningAth[b4Idx] - 1;
      if (b4Dr <= -0.02 && b4Dd <= -0.1) {
        const b4V20 = annualVol20(spVals, b4Idx);
        const b4Age = b4Idx - runningAthIdx[b4Idx];
        const b4AgeOk = !(b4Age >= 91 && b4Age <= 252);
        if (b4V20 && b4V20 > 0.25 && b4AgeOk) {
          const b4Date = spDates[b4Idx];
          const { crs: b4Crs } = computeCRS({
            date: b4Date,
            vixDates, vixVals,
            hygDates, hygVals,
            dxyDates, dxyVals,
            rspDates, rspVals,
            spDates, spVals,
            ageAth: b4Age,
          });
          if (b4Crs >= 2) {
            b4Active = true;
            b4BaseDate = b4Date;
          }
        }
      }
    }
  }

  // EFA / EEM グローバルシグナル (decisions/0042 相当)
  const [, efaVals] = efaResult ?? [[], []];
  const [, eemVals] = eemResult ?? [[], []];
  const { athDd: efaAthDd, active: efaActive } = computeGlobalPhi2(efaVals, crs);
  const { athDd: eemAthDd, active: eemActive } = computeGlobalPhi2(eemVals, crs);

  // QQQ: ATH-18% 閾値（R48 パラメータ最適化結果）
  const [, qqqVals] = qqqResult ?? [[], []];
  const { athDd: qqqAthDd, active: qqqActive } = computeGlobalPhi2(qqqVals, crs, -0.18);

  // VT (オルカン): SP500 phi2 連動（独立シグナル不使用 — Round 49 結果より）
  const [, vtVals] = vtResult ?? [[], []];
  const vtAthDdRaw = vtVals.length >= 30
    ? (() => {
        let ath = vtVals[0];
        for (const v of vtVals) if (v > ath) ath = v;
        return vtVals[vtVals.length - 1] / ath - 1;
      })()
    : null;
  const vtActive = phi2Active; // SP500 phi2 発動時に連動

  let signalTier: SignalData["signalTier"];
  if (phi2Active && rsi25Crossunder) signalTier = "DOUBLE";
  else if (phi2Active) signalTier = "PHI2";
  else if (rsi25Crossunder) signalTier = "RSI25";
  else if (athDd <= -0.1) signalTier = "NEAR";
  else signalTier = "NONE";

  // 直近30日の phi2 候補日（history セクション表示用）
  const history: TriggerDay[] = [];
  for (let i = Math.max(1, n - 30); i < n - 1; i++) {
    const dr = spVals[i] / spVals[i - 1] - 1;
    const dd = spVals[i] / runningAth[i] - 1;
    if (dr > -0.02 || dd > -0.1) continue;
    const v20 = annualVol20(spVals, i);
    if (!v20 || v20 <= 0.25) continue;
    const age = i - runningAthIdx[i];
    const dateI = spDates[i];

    let crsI: number | null = null;
    if (hygVals.length > 0 && vixVals.length > 0) {
      const res = computeCRS({
        date: dateI,
        vixDates, vixVals,
        hygDates, hygVals,
        dxyDates, dxyVals,
        rspDates, rspVals,
        spDates, spVals,
        ageAth: age,
      });
      crsI = res.crs;
    }

    const ageOk = !(age >= 91 && age <= 252);
    history.push({
      date: dateI,
      dayRet: dr,
      athDd: dd,
      ageAth: age,
      vol20: v20,
      crs: crsI,
      phi2v3: ageOk && (crsI === null || crsI >= 2),
    });
  }

  // 過去2年の phi2 類似事例（実際のリターン付き）
  const pastEpisodes: PastEpisode[] = [];
  for (let i = 21; i < n - 1; i++) {
    const dr = spVals[i] / spVals[i - 1] - 1;
    const dd = spVals[i] / runningAth[i] - 1;
    if (dr > -0.02 || dd > -0.1) continue;
    const v20 = annualVol20(spVals, i);
    if (!v20 || v20 <= 0.25) continue;
    const age = i - runningAthIdx[i];
    if (age >= 91 && age <= 252) continue; // ageAthOk フィルタ
    pastEpisodes.push({
      date: spDates[i],
      athDd: dd,
      dayRet: dr,
      vol20: v20,
      retToDate: spVals[n - 1] / spVals[i] - 1,
      daysAgo: n - 1 - i,
    });
  }
  pastEpisodes.reverse(); // 新しい順

  return {
    date: lastDate,
    price: last,
    ath,
    athDd,
    ageAth,
    ageAthOk,
    vol20,
    dayRet,
    rsi14,
    vix,
    crs,
    crsComponents,
    phi2Active,
    rsi25Active,
    rsi25Crossunder,
    hygSignal,
    b4Active,
    b4BaseDate,
    efaAthDd: efaVals.length >= 30 ? efaAthDd : null,
    efaActive,
    eemAthDd: eemVals.length >= 30 ? eemAthDd : null,
    eemActive,
    qqqAthDd: qqqVals.length >= 30 ? qqqAthDd : null,
    qqqActive,
    vtAthDd: vtAthDdRaw,
    vtActive,
    signalTier,
    history,
    pastEpisodes,
    jpSignals: Array.isArray(jpSignals) ? jpSignals : [],
  };
}
