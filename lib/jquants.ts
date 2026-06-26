const BASE = "https://api.jquants.com/v1";

// ── 認証 ────────────────────────────────────────────────────────────────────

async function getRefreshToken(): Promise<string> {
  const email = process.env.JQUANTS_EMAIL;
  const password = process.env.JQUANTS_PASSWORD;
  if (!email || !password) throw new Error("JQUANTS_EMAIL / JQUANTS_PASSWORD が未設定");

  const res = await fetch(`${BASE}/token/auth_user`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mailaddress: email, password }),
  });
  if (!res.ok) throw new Error(`J-Quants auth_user failed: ${res.status}`);
  const { refreshToken } = await res.json();
  if (!refreshToken) throw new Error("refreshToken が返ってこなかった");
  return refreshToken as string;
}

async function getIdToken(refreshToken: string): Promise<string> {
  const res = await fetch(`${BASE}/token/auth_refresh?refreshtoken=${refreshToken}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(`J-Quants auth_refresh failed: ${res.status}`);
  const { idToken } = await res.json();
  if (!idToken) throw new Error("idToken が返ってこなかった");
  return idToken as string;
}

async function getToken(): Promise<string> {
  const refresh = await getRefreshToken();
  return getIdToken(refresh);
}

// ── 汎用フェッチ ─────────────────────────────────────────────────────────────

async function jquantsGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const token = await getToken();
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`J-Quants ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface JqListedInfo {
  Code: string;
  CompanyName: string;
  CompanyNameEnglish: string;
  Sector17Code: string;
  Sector17CodeName: string;
  Sector33Code: string;
  Sector33CodeName: string;
  ScaleCategory: string;
  MarketCode: string;
  MarketCodeName: string;
}

export interface JqStatement {
  DisclosedDate: string;
  DisclosedTime: string;
  LocalCode: string;
  DisclosureNumber: string;
  TypeOfDocument: string;
  TypeOfCurrentPeriod: string;
  CurrentPeriodStartDate: string;
  CurrentPeriodEndDate: string;
  CurrentFiscalYearStartDate: string;
  CurrentFiscalYearEndDate: string;
  NextFiscalYearStartDate: string;
  NextFiscalYearEndDate: string;
  NetSales: string;
  OperatingProfit: string;
  OrdinaryProfit: string;
  Profit: string;
  EarningsPerShare: string;
  DilutedEarningsPerShare: string;
  TotalAssets: string;
  Equity: string;
  EquityToAssetRatio: string;
  BookValuePerShare: string;
  CashFlowsFromOperatingActivities: string;
  CashFlowsFromInvestingActivities: string;
  CashFlowsFromFinancingActivities: string;
  CashAndEquivalents: string;
  ResultDividendPerShareAnnual: string;
  ResultPayoutRatioAnnual: string;
  ForecastDividendPerShareAnnual: string;
  ForecastEarningsPerShare: string;
  NextYearForecastDividendPerShareAnnual: string;
  NextYearForecastEarningsPerShare: string;
  ForecastNetSales: string;
  ForecastOperatingProfit: string;
  ForecastOrdinaryProfit: string;
  ForecastProfit: string;
  NumberOfIssuedAndOutstandingSharesAtTheEndOfFiscalYearIncludingTreasuryStock: string;
}

export interface JqDailyQuote {
  Date: string;
  Code: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
  TurnoverValue: number;
  AdjustmentFactor: number;
  AdjustmentOpen: number;
  AdjustmentHigh: number;
  AdjustmentLow: number;
  AdjustmentClose: number;
  AdjustmentVolume: number;
}

// ── API呼び出し ───────────────────────────────────────────────────────────────

/** 全上場銘柄マスタを取得 */
export async function fetchListedInfo(): Promise<JqListedInfo[]> {
  const data = await jquantsGet<{ info: JqListedInfo[] }>("/listed/info");
  return data.info ?? [];
}

/** 単一銘柄の最新財務諸表を取得（通期決算のみ） */
export async function fetchStatements(code: string): Promise<JqStatement[]> {
  const data = await jquantsGet<{ statements: JqStatement[] }>("/fins/statements", { code });
  return (data.statements ?? []).filter(
    (s) => s.TypeOfDocument?.includes("Annual") || s.TypeOfCurrentPeriod === "FY"
  );
}

/** 単一銘柄の最新株価を取得（直近営業日） */
export async function fetchLatestQuote(code: string): Promise<JqDailyQuote | null> {
  // コードは4桁 + "0"の5桁形式が必要
  const paddedCode = code.length === 4 ? code + "0" : code;
  const data = await jquantsGet<{ daily_quotes: JqDailyQuote[] }>(
    "/prices/daily_quotes",
    { code: paddedCode }
  );
  const quotes = data.daily_quotes ?? [];
  return quotes.length > 0 ? quotes[quotes.length - 1] : null;
}

// ── 派生指標計算 ─────────────────────────────────────────────────────────────

export interface ScreenerMetrics {
  code: string;
  name: string;
  market: string;
  sector: string;
  price: number | null;
  pbr: number | null;
  per: number | null;
  roe: number | null;
  roa: number | null;
  equityRatio: number | null;        // 自己資本比率 (0〜1)
  operatingMargin: number | null;    // 営業利益率 (0〜1)
  dividendYield: number | null;      // 配当利回り (0〜1)
  revenueGrowthYoy: number | null;   // 売上成長率 前年比 (0〜1)
  netSales: number | null;
  operatingProfit: number | null;
  totalAssets: number | null;
  equity: number | null;
  // ラベル
  growthFlag: "急成長（要注意）" | "安定成長" | "横ばい" | "縮小中" | null;
  valueFlag: "優良バリュー" | "急成長警戒" | "低収益放置" | "高収益割安" | null;
}

export function calcMetrics(
  info: JqListedInfo,
  statements: JqStatement[],
  quote: JqDailyQuote | null
): ScreenerMetrics {
  const base: ScreenerMetrics = {
    code: info.Code,
    name: info.CompanyName,
    market: info.MarketCodeName,
    sector: info.Sector33CodeName,
    price: quote?.AdjustmentClose ?? null,
    pbr: null, per: null, roe: null, roa: null,
    equityRatio: null, operatingMargin: null,
    dividendYield: null, revenueGrowthYoy: null,
    netSales: null, operatingProfit: null,
    totalAssets: null, equity: null,
    growthFlag: null, valueFlag: null,
  };

  if (statements.length === 0) return base;

  // 最新・前期の通期決算を取る
  const sorted = [...statements].sort(
    (a, b) => b.CurrentFiscalYearEndDate.localeCompare(a.CurrentFiscalYearEndDate)
  );
  const latest = sorted[0];
  const prev = sorted[1] ?? null;

  const n = (s: string) => (s && s !== "" ? parseFloat(s) : null);

  const price = base.price;
  const equity = n(latest.Equity);
  const totalAssets = n(latest.TotalAssets);
  const netSales = n(latest.NetSales);
  const opProfit = n(latest.OperatingProfit);
  const eps = n(latest.EarningsPerShare);
  const bvps = n(latest.BookValuePerShare);
  const divAnnual = n(latest.ResultDividendPerShareAnnual) ?? n(latest.ForecastDividendPerShareAnnual);
  const eqRatio = n(latest.EquityToAssetRatio);
  const prevSales = prev ? n(prev.NetSales) : null;

  base.netSales = netSales;
  base.operatingProfit = opProfit;
  base.totalAssets = totalAssets;
  base.equity = equity;

  // 自己資本比率（APIが返す値は 0〜1 か 0〜100 か不定のため正規化）
  if (eqRatio !== null) {
    base.equityRatio = eqRatio > 1 ? eqRatio / 100 : eqRatio;
  } else if (equity !== null && totalAssets !== null && totalAssets > 0) {
    base.equityRatio = equity / totalAssets;
  }

  // 営業利益率
  if (opProfit !== null && netSales !== null && netSales > 0) {
    base.operatingMargin = opProfit / netSales;
  }

  // 売上成長率
  if (netSales !== null && prevSales !== null && prevSales > 0) {
    base.revenueGrowthYoy = (netSales - prevSales) / prevSales;
  }

  // ROA
  if (opProfit !== null && totalAssets !== null && totalAssets > 0) {
    base.roa = opProfit / totalAssets;
  }

  if (price !== null && price > 0) {
    // PBR = 株価 / 1株純資産
    if (bvps !== null && bvps > 0) base.pbr = price / bvps;
    // PER = 株価 / EPS
    if (eps !== null && eps > 0) base.per = price / eps;
    // ROE = EPS / BVPS
    if (eps !== null && bvps !== null && bvps > 0) base.roe = eps / bvps;
    // 配当利回り
    if (divAnnual !== null && divAnnual > 0) base.dividendYield = divAnnual / price;
  }

  // 成長フラグ
  const g = base.revenueGrowthYoy;
  if (g !== null) {
    if (g > 0.20) base.growthFlag = "急成長（要注意）";
    else if (g >= 0.05) base.growthFlag = "安定成長";
    else if (g >= 0) base.growthFlag = "横ばい";
    else base.growthFlag = "縮小中";
  }

  // 複合バリューフラグ
  const { pbr, equityRatio, roe, per, operatingMargin } = base;
  const eq = equityRatio ?? 0;
  const growth = base.revenueGrowthYoy ?? 0;

  if (pbr !== null && pbr <= 0.5 && eq >= 0.6 && roe !== null && roe >= 0.05) {
    base.valueFlag = "優良バリュー";
  } else if (growth > 0.20 && eq < 0.5) {
    base.valueFlag = "急成長警戒";
  } else if (pbr !== null && pbr <= 0.5 && roe !== null && roe < 0.03) {
    base.valueFlag = "低収益放置";
  } else if (per !== null && per <= 12 && operatingMargin !== null && operatingMargin >= 0.15) {
    base.valueFlag = "高収益割安";
  }

  return base;
}
