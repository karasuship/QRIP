/**
 * 日次市場データ取得・指標計算モジュール
 * decisions/0025 に基づくスキーマの全カラムを計算する
 */

type Nullable<T> = T | null;

// ──────────────────────────────────────────────
// 内部ユーティリティ
// ──────────────────────────────────────────────

async function fetchTicker(
  ticker: string,
  range = "3mo"
): Promise<[string[], number[]] | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${range}&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const ts: number[] = result.timestamp ?? [];
    const raw: Nullable<number>[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ?? [];

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

function last(arr: number[]): number | null {
  return arr.length > 0 ? arr[arr.length - 1] : null;
}

function nthLast(arr: number[], n: number): number | null {
  return arr.length >= n ? arr[arr.length - n] : null;
}

function annualVol(vals: number[], n = 20): number | null {
  if (vals.length < n + 1) return null;
  const slice = vals.slice(vals.length - n - 1);
  const rets = slice.slice(1).map((v, i) => Math.log(v / slice[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

function wilderRSI(vals: number[], period = 14): number | null {
  if (vals.length < period + 1) return null;
  const slice = vals.slice(vals.length - period - 15); // warmup
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = slice[i] - slice[i - 1];
    if (d > 0) ag += d; else al -= d;
  }
  ag /= period; al /= period;
  for (let i = period + 1; i < slice.length; i++) {
    const d = slice[i] - slice[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  if (al === 0) return 100;
  return 100 - 100 / (1 + ag / al);
}

// ATH + age 計算（SP500 の長期データから）
function computeAth(vals: number[]): { ath: number; ageAth: number; athDd: number } {
  let ath = vals[0], athIdx = 0;
  for (let i = 1; i < vals.length; i++) {
    if (vals[i] > ath) { ath = vals[i]; athIdx = i; }
  }
  const ageAth = vals.length - 1 - athIdx;
  const athDd = vals[vals.length - 1] / ath - 1;
  return { ath, ageAth, athDd };
}

// ──────────────────────────────────────────────
// COT: CFTC 機関投資家ポジション（週次）
// E-Mini S&P 500 = contract code 138741
// ──────────────────────────────────────────────
interface COTData {
  reportDate: string;
  amNet: number;     // Asset Manager（年金・保険）ネットポジション
  amNetPct: number;  // 対建玉比
  levNet: number;    // Leveraged Money（ヘッジファンド）ネット
  levNetPct: number; // 対建玉比（高い=HF強気・低い=逆張り候補）
}

async function fetchCOT(): Promise<COTData | null> {
  const url =
    "https://publicreporting.cftc.gov/resource/jun7-fc8e.json" +
    "?cftc_contract_market_code=138741" +
    "&%24order=report_date_as_yyyy_mm_dd+DESC" +
    "&%24limit=1";
  try {
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const row = data[0];
    const amLong  = parseFloat(row.asset_mgr_positions_long_all  ?? "0");
    const amShort = parseFloat(row.asset_mgr_positions_short_all ?? "0");
    const levLong  = parseFloat(row.lev_money_positions_long_all  ?? "0");
    const levShort = parseFloat(row.lev_money_positions_short_all ?? "0");
    const oi = parseFloat(row.open_interest_all ?? "1") || 1;
    return {
      reportDate: row.report_date_as_yyyy_mm_dd ?? "",
      amNet: amLong - amShort,
      amNetPct: (amLong - amShort) / oi,
      levNet: levLong - levShort,
      levNetPct: (levLong - levShort) / oi,
    };
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// AAII 個人投資家センチメント（週次・HTML スクレイピング）
// ──────────────────────────────────────────────
interface AAIIData {
  bullish: number;
  neutral: number;
  bearish: number;
  bullBear: number; // 強気-弱気スプレッド
}

async function fetchAAII(): Promise<AAIIData | null> {
  try {
    const res = await fetch("https://www.aaii.com/sentimentsurvey", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // AAII のページから数値を抽出（例: "38.7%" の形式）
    const extract = (label: string): number | null => {
      const re = new RegExp(label + "[\\s\\S]*?([\\d.]+)\\s*%", "i");
      const m = html.match(re);
      return m ? parseFloat(m[1]) : null;
    };
    const bullish = extract("Bullish");
    const neutral = extract("Neutral");
    const bearish = extract("Bearish");
    if (bullish === null || bearish === null) return null;
    return {
      bullish,
      neutral: neutral ?? 100 - bullish - bearish,
      bearish,
      bullBear: bullish - bearish,
    };
  } catch {
    return null;
  }
}

// FRED から週次データを取得（APIキー不要のCSVエンドポイント）
async function fetchFRED(seriesId: string): Promise<[string[], number[]] | null> {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=2023-01-01`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    const lines = text.trim().split("\n").slice(1); // ヘッダー除去
    const dates: string[] = [];
    const vals: number[] = [];
    for (const line of lines) {
      const [d, v] = line.split(",");
      const n = parseFloat(v);
      if (d && !isNaN(n)) { dates.push(d.trim()); vals.push(n); }
    }
    return dates.length > 0 ? [dates, vals] : null;
  } catch {
    return null;
  }
}

// セクター 20日相対強度（vs SP500）
function sectorRS(
  sectorVals: number[],
  spVals: number[],
  spDates: string[],
  sectorDates: string[],
  n = 20
): number | null {
  if (sectorVals.length < n + 1) return null;
  const sCur = last(sectorVals)!;
  const sPrev = nthLast(sectorVals, n + 1);
  if (!sPrev) return null;
  const lastDate = sectorDates[sectorDates.length - 1];
  const spIdx = spDates.lastIndexOf(lastDate);
  if (spIdx < n) return null;
  const spCur = spVals[spIdx];
  const spPrev = spVals[spIdx - n];
  return (sCur / sPrev) / (spCur / spPrev) - 1;
}

// ──────────────────────────────────────────────
// 公開インターフェース
// ──────────────────────────────────────────────

export interface MarketSnapshot {
  date: string;
  // SP500
  sp500_close: number;
  sp500_ath: number;
  sp500_ath_dd: number;
  sp500_age_ath: number;
  sp500_vol20: Nullable<number>;
  sp500_day_ret: Nullable<number>;
  sp500_rsi14: Nullable<number>;
  // CRS
  crs_score: number;
  crs_c1_vix30: boolean;
  crs_c2_hyg3d: boolean;
  crs_c3_dxy5d: boolean;
  crs_c4_age90: boolean;
  crs_c5_hyg60: boolean;
  crs_c6_rsp_weak: boolean;
  // phi2 v3
  phi2_active: boolean;
  rsi25_crossunder: boolean;
  signal_tier: string;
  // VIX
  vix_9d: Nullable<number>;
  vix_spot: Nullable<number>;
  vix_3m: Nullable<number>;
  vix_term_ratio: Nullable<number>;
  skew_index: Nullable<number>;
  // Credit
  hyg_close: Nullable<number>;
  lqd_close: Nullable<number>;
  jnk_close: Nullable<number>;
  tlt_close: Nullable<number>;
  hyg_3d_ret: Nullable<number>;
  hyg_60d_hi_dd: Nullable<number>;
  lqd_hyg_spread: Nullable<number>;
  // Rates
  irx: Nullable<number>;
  fvx: Nullable<number>;
  tnx: Nullable<number>;
  tyx: Nullable<number>;
  yield_2_10: Nullable<number>;
  yield_3m_10: Nullable<number>;
  // Dollar
  dxy_close: Nullable<number>;
  dxy_5d_ret: Nullable<number>;
  usdjpy: Nullable<number>;
  // Breadth
  rsp_close: Nullable<number>;
  rsp_5d_vs_sp: Nullable<number>;
  iwm_close: Nullable<number>;
  iwm_20d_vs_sp: Nullable<number>;
  // Sectors
  xlk_rs: Nullable<number>; xlf_rs: Nullable<number>; xle_rs: Nullable<number>;
  xlv_rs: Nullable<number>; xli_rs: Nullable<number>; xly_rs: Nullable<number>;
  xlp_rs: Nullable<number>; xlu_rs: Nullable<number>; xlb_rs: Nullable<number>;
  xlre_rs: Nullable<number>; xlc_rs: Nullable<number>;
  // Global
  efa_close: Nullable<number>;
  eem_close: Nullable<number>;
  // Real
  gld_close: Nullable<number>;
  uso_close: Nullable<number>;
  // Alternative / sentiment
  btc_close: Nullable<number>;
  btc_20d_ret: Nullable<number>;
  btc_sp500_corr20: Nullable<number>;
  copper_close: Nullable<number>;
  copper_20d_ret: Nullable<number>;
  put_call_ratio: Nullable<number>;
  // MMF（マネーマーケットファンド待機資金）
  mmf_retail: Nullable<number>;
  mmf_institutional: Nullable<number>;
  mmf_total: Nullable<number>;
  mmf_4w_change: Nullable<number>;
  // COT（機関投資家ポジション）
  cot_report_date: Nullable<string>;
  cot_am_net_pct: Nullable<number>;
  cot_lev_net_pct: Nullable<number>;
  // AAII 個人センチメント
  aaii_bullish: Nullable<number>;
  aaii_bearish: Nullable<number>;
  aaii_bull_bear: Nullable<number>;
  // FFR（実効政策金利下限）
  ffr_target: Nullable<number>;
}

export async function fetchMarketSnapshot(): Promise<MarketSnapshot> {
  // 全ティッカーを並列取得（SP500 は ATH 計算のため 2y）
  const [
    spRes, hygRes, lqdRes, jnkRes, tltRes,
    vix9dRes, vixRes, vix3mRes, skewRes,
    irxRes, fvxRes, tnxRes, tyxRes,
    dxyRes, usdJpyRes,
    rspRes, iwmRes,
    xlkRes, xlfRes, xleRes, xlvRes, xliRes,
    xlyRes, xlpRes, xluRes, xlbRes, xlreRes, xlcRes,
    efaRes, eemRes, gldRes, usoRes,
    btcRes, copperRes, pcRes,
    mmfRetailRes, mmfInstRes, ffrRes,
  ] = await Promise.all([
    fetchTicker("%5EGSPC", "2y"),
    fetchTicker("HYG", "6mo"),
    fetchTicker("LQD", "6mo"),
    fetchTicker("JNK", "3mo"),
    fetchTicker("TLT", "3mo"),
    fetchTicker("%5EVIX9D", "1mo"),
    fetchTicker("%5EVIX", "1mo"),
    fetchTicker("%5EVIX3M", "1mo"),
    fetchTicker("%5ESKEW", "1mo"),
    fetchTicker("%5EIRX", "1mo"),
    fetchTicker("%5EFVX", "1mo"),
    fetchTicker("%5ETNX", "1mo"),
    fetchTicker("%5ETYX", "1mo"),
    fetchTicker("DX-Y.NYB", "1mo"),
    fetchTicker("JPY%3DX", "1mo"),
    fetchTicker("RSP", "3mo"),
    fetchTicker("IWM", "3mo"),
    fetchTicker("XLK", "3mo"), fetchTicker("XLF", "3mo"),
    fetchTicker("XLE", "3mo"), fetchTicker("XLV", "3mo"),
    fetchTicker("XLI", "3mo"), fetchTicker("XLY", "3mo"),
    fetchTicker("XLP", "3mo"), fetchTicker("XLU", "3mo"),
    fetchTicker("XLB", "3mo"), fetchTicker("XLRE", "3mo"),
    fetchTicker("XLC", "3mo"),
    fetchTicker("EFA", "3mo"), fetchTicker("EEM", "3mo"),
    fetchTicker("GLD", "3mo"), fetchTicker("USO", "3mo"),
    fetchTicker("BTC-USD", "3mo"),
    fetchTicker("HG%3DF", "3mo"),
    fetchTicker("%5ECPCE", "1mo"),
    fetchFRED("WRMFSL"),    // 個人 MMF（週次・10億ドル）
    fetchFRED("WRMFNS"),    // 機関 MMF（週次・10億ドル）
    fetchFRED("DFEDTARL"),  // FF金利誘導目標・下限（FOMC決定値）
  ]);

  // 週次データ（COT・AAII）は並列で追加取得
  const [cotData, aaiiData] = await Promise.all([
    fetchCOT(),
    fetchAAII(),
  ]);

  if (!spRes) throw new Error("SP500 データ取得失敗");
  const [spDates, spVals] = spRes;
  const n = spVals.length;
  if (n < 30) throw new Error("SP500 データ不足");

  const date = spDates[n - 1];

  // SP500 基本指標
  const { ath, ageAth, athDd } = computeAth(spVals);
  const sp500_vol20 = annualVol(spVals, 20);
  const sp500_day_ret = n >= 2 ? spVals[n - 1] / spVals[n - 2] - 1 : null;
  const sp500_rsi14 = wilderRSI(spVals);
  const prevRsi14 = n >= 2 ? wilderRSI(spVals.slice(0, n - 1)) : null;

  // HYG 派生
  const [hygDates, hygVals] = hygRes ?? [[], []];
  const hygN = hygVals.length;
  const hyg_close = last(hygVals);
  const hyg_3d_ret = hygN >= 4 ? hygVals[hygN - 1] / hygVals[hygN - 4] - 1 : null;
  const hyg_60d_hi_dd =
    hygN >= 61
      ? hygVals[hygN - 1] / Math.max(...hygVals.slice(hygN - 61)) - 1
      : null;

  // LQD/JNK/TLT
  const [, lqdVals] = lqdRes ?? [[], []];
  const [, jnkVals] = jnkRes ?? [[], []];
  const [, tltVals] = tltRes ?? [[], []];
  const lqd_close = last(lqdVals);
  const jnk_close = last(jnkVals);
  const tlt_close = last(tltVals);
  // LQD vs HYG 20日相対（IG の相対強さ → -はリスクオフの強さ）
  const lqd_hyg_spread =
    lqdVals.length >= 21 && hygVals.length >= 21
      ? (lqdVals[lqdVals.length - 1] / lqdVals[lqdVals.length - 21]) /
        (hygVals[hygVals.length - 1] / hygVals[hygVals.length - 21]) - 1
      : null;

  // VIX ターム構造
  const [, vix9dVals] = vix9dRes ?? [[], []];
  const [, vixVals] = vixRes ?? [[], []];
  const [, vix3mVals] = vix3mRes ?? [[], []];
  const [, skewVals] = skewRes ?? [[], []];
  const vix_9d = last(vix9dVals);
  const vix_spot = last(vixVals);
  const vix_3m = last(vix3mVals);
  const vix_term_ratio =
    vix_9d !== null && vix_spot !== null && vix_spot > 0
      ? vix_9d / vix_spot
      : null;
  const skew_index = last(skewVals);

  // 金利
  const [, irxVals] = irxRes ?? [[], []];
  const [, fvxVals] = fvxRes ?? [[], []];
  const [, tnxVals] = tnxRes ?? [[], []];
  const [, tyxVals] = tyxRes ?? [[], []];
  const irx = last(irxVals);
  const fvx = last(fvxVals);
  const tnx = last(tnxVals);
  const tyx = last(tyxVals);
  // 2yr は Yahoo で ^FVX→5yr。2yr は ^TNX-IRX で代用不可なので 3m-10yr のみ
  const yield_2_10 = tnx !== null && fvx !== null ? tnx - fvx : null; // 代替: 10yr-5yr
  const yield_3m_10 = tnx !== null && irx !== null ? tnx - irx : null;

  // ドル
  const [dxyDates, dxyVals] = dxyRes ?? [[], []];
  const dxy_close = last(dxyVals);
  const dxyN = dxyVals.length;
  const dxy_5d_ret = dxyN >= 6 ? dxyVals[dxyN - 1] / dxyVals[dxyN - 6] - 1 : null;
  const [, jpyVals] = usdJpyRes ?? [[], []];
  const usdjpy = last(jpyVals);

  // 市場幅
  const [rspDates, rspVals] = rspRes ?? [[], []];
  const rsp_close = last(rspVals);
  const rspN = rspVals.length;
  const sp500_5d_ret = n >= 6 ? spVals[n - 1] / spVals[n - 6] - 1 : null;
  const rsp_5d_ret = rspN >= 6 ? rspVals[rspN - 1] / rspVals[rspN - 6] - 1 : null;
  const rsp_5d_vs_sp =
    rsp_5d_ret !== null && sp500_5d_ret !== null
      ? rsp_5d_ret - sp500_5d_ret
      : null;
  const [iwmDates, iwmVals] = iwmRes ?? [[], []];
  const iwm_close = last(iwmVals);
  const iwm_20d_vs_sp = sectorRS(iwmVals, spVals, spDates, iwmDates);

  // CRS 計算
  const c1 = vix_spot !== null && vix_spot > 30;
  const c2 = hyg_3d_ret !== null && hyg_3d_ret <= 0;
  const c3 = dxy_5d_ret !== null && dxy_5d_ret >= 0;
  const c4 = ageAth <= 90;
  const c5 = hyg_60d_hi_dd !== null && hyg_60d_hi_dd <= -0.08;
  const c6 = rsp_5d_vs_sp !== null && rsp_5d_vs_sp < 0;
  const crs_score = [c1, c2, c3, c4, c5, c6].filter(Boolean).length;

  // phi2 v3 判定
  const ageAthOk = !(ageAth >= 91 && ageAth <= 252);
  const phi2_active =
    athDd <= -0.1 &&
    sp500_day_ret !== null && sp500_day_ret <= -0.02 &&
    sp500_vol20 !== null && sp500_vol20 > 0.25 &&
    ageAthOk &&
    crs_score >= 2;

  const rsi25Active = sp500_rsi14 !== null && sp500_rsi14 < 25;
  const rsi25_crossunder = rsi25Active && (prevRsi14 === null || prevRsi14 >= 25);

  let signal_tier: string;
  if (phi2_active && rsi25_crossunder) signal_tier = "DOUBLE";
  else if (phi2_active) signal_tier = "PHI2";
  else if (rsi25_crossunder) signal_tier = "RSI25";
  else if (athDd <= -0.1) signal_tier = "NEAR";
  else signal_tier = "NONE";

  // セクター相対強度（20日）
  const secMap = new Map([
    ["XLK", xlkRes], ["XLF", xlfRes], ["XLE", xleRes], ["XLV", xlvRes],
    ["XLI", xliRes], ["XLY", xlyRes], ["XLP", xlpRes], ["XLU", xluRes],
    ["XLB", xlbRes], ["XLRE", xlreRes], ["XLC", xlcRes],
  ]);
  function secRS(res: [string[], number[]] | null): Nullable<number> {
    if (!res) return null;
    return sectorRS(res[1], spVals, spDates, res[0]);
  }

  // グローバル・実物
  const [, efaVals] = efaRes ?? [[], []];
  const [, eemVals] = eemRes ?? [[], []];
  const [, gldVals] = gldRes ?? [[], []];
  const [, usoVals] = usoRes ?? [[], []];

  // BTC / 銅 / プットコール比
  const [btcDates, btcVals] = btcRes ?? [[], []];
  const btcN = btcVals.length;
  const btc_close = last(btcVals);
  const btc_20d_ret = btcN >= 21 ? btcVals[btcN - 1] / btcVals[btcN - 21] - 1 : null;

  // BTC-SP500 20日ローリング相関（日次リターンのピアソン相関）
  // SP500 営業日ベースで BTC を日付アラインして計算
  let btc_sp500_corr20: Nullable<number> = null;
  if (btcN >= 21 && n >= 21) {
    const btcByDate = new Map<string, number>();
    btcDates.forEach((d, i) => btcByDate.set(d, btcVals[i]));
    // SP500 の最新20日の営業日に合わせる
    const spRets: number[] = [];
    const bRets: number[] = [];
    for (let i = n - 20; i < n; i++) {
      const spRet = spVals[i] / spVals[i - 1] - 1;
      const b0 = btcByDate.get(spDates[i]);
      const b1 = btcByDate.get(spDates[i - 1]);
      if (b0 !== undefined && b1 !== undefined) {
        spRets.push(spRet);
        bRets.push(b0 / b1 - 1);
      }
    }
    if (spRets.length >= 10) {
      const meanSp = spRets.reduce((a, b) => a + b, 0) / spRets.length;
      const meanB = bRets.reduce((a, b) => a + b, 0) / bRets.length;
      let cov = 0, varSp = 0, varB = 0;
      for (let i = 0; i < spRets.length; i++) {
        const ds = spRets[i] - meanSp;
        const db = bRets[i] - meanB;
        cov += ds * db; varSp += ds * ds; varB += db * db;
      }
      const denom = Math.sqrt(varSp * varB);
      btc_sp500_corr20 = denom > 0 ? cov / denom : null;
    }
  }

  const [, copperVals] = copperRes ?? [[], []];
  const copperN = copperVals.length;
  const copper_close = last(copperVals);
  const copper_20d_ret = copperN >= 21 ? copperVals[copperN - 1] / copperVals[copperN - 21] - 1 : null;

  const [, pcVals] = pcRes ?? [[], []];
  const put_call_ratio = last(pcVals);

  // MMF 待機資金（週次・最新値を使う）
  const [, mmfRVals] = mmfRetailRes ?? [[], []];
  const [, mmfIVals] = mmfInstRes ?? [[], []];
  const mmf_retail = last(mmfRVals);
  const mmf_institutional = last(mmfIVals);
  const mmf_total =
    mmf_retail !== null && mmf_institutional !== null
      ? mmf_retail + mmf_institutional
      : null;
  // 4週前比（約1ヶ月の資金フロー方向）
  const mmfRN = mmfRVals.length;
  const mmfIN = mmfIVals.length;
  const mmf_4w_change =
    mmfRN >= 5 && mmfIN >= 5
      ? (mmfRVals[mmfRN - 1] + mmfIVals[mmfIN - 1]) -
        (mmfRVals[mmfRN - 5] + mmfIVals[mmfIN - 5])
      : null;

  // FFR（政策金利下限）
  const [, ffrVals] = ffrRes ?? [[], []];
  const ffr_target = last(ffrVals);

  return {
    date,
    sp500_close: spVals[n - 1],
    sp500_ath: ath,
    sp500_ath_dd: athDd,
    sp500_age_ath: ageAth,
    sp500_vol20,
    sp500_day_ret,
    sp500_rsi14,
    crs_score,
    crs_c1_vix30: c1, crs_c2_hyg3d: c2, crs_c3_dxy5d: c3,
    crs_c4_age90: c4, crs_c5_hyg60: c5, crs_c6_rsp_weak: c6,
    phi2_active,
    rsi25_crossunder,
    signal_tier,
    vix_9d, vix_spot, vix_3m, vix_term_ratio, skew_index,
    hyg_close, lqd_close, jnk_close, tlt_close,
    hyg_3d_ret, hyg_60d_hi_dd, lqd_hyg_spread,
    irx, fvx, tnx, tyx, yield_2_10, yield_3m_10,
    dxy_close, dxy_5d_ret, usdjpy,
    rsp_close, rsp_5d_vs_sp, iwm_close, iwm_20d_vs_sp,
    xlk_rs: secRS(xlkRes), xlf_rs: secRS(xlfRes), xle_rs: secRS(xleRes),
    xlv_rs: secRS(xlvRes), xli_rs: secRS(xliRes), xly_rs: secRS(xlyRes),
    xlp_rs: secRS(xlpRes), xlu_rs: secRS(xluRes), xlb_rs: secRS(xlbRes),
    xlre_rs: secRS(xlreRes), xlc_rs: secRS(xlcRes),
    efa_close: last(efaVals), eem_close: last(eemVals),
    gld_close: last(gldVals), uso_close: last(usoVals),
    btc_close, btc_20d_ret, btc_sp500_corr20,
    copper_close, copper_20d_ret, put_call_ratio,
    mmf_retail, mmf_institutional, mmf_total, mmf_4w_change,
    cot_report_date: cotData?.reportDate ?? null,
    cot_am_net_pct: cotData?.amNetPct ?? null,
    cot_lev_net_pct: cotData?.levNetPct ?? null,
    aaii_bullish: aaiiData?.bullish ?? null,
    aaii_bearish: aaiiData?.bearish ?? null,
    aaii_bull_bear: aaiiData?.bullBear ?? null,
    ffr_target,
  };
}

/**
 * SP500 の特定日のインデックスと価格を返す（phi2_signals の事後リターン計算用）
 */
export async function fetchSP500History(): Promise<[string[], number[]] | null> {
  return fetchTicker("%5EGSPC", "2y");
}
