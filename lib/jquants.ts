const BASE = "https://api.jquants.com/v1";

// ── 汎用フェッチ ─────────────────────────────────────────────────────────────

async function jquantsGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) throw new Error("JQUANTS_API_KEY が未設定");

  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`J-Quants ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── 型定義 ───────────────────────────────────────────────────────────────────

export interface JqEquity {
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

export interface JqFinSummary {
  DisclosedDate: string;
  LocalCode: string;
  TypeOfDocument: string;
  TypeOfCurrentPeriod: string;
  CurrentFiscalYearStartDate: string;
  CurrentFiscalYearEndDate: string;
  NetSales: string | null;
  OperatingProfit: string | null;
  OrdinaryProfit: string | null;
  Profit: string | null;
  EarningsPerShare: string | null;
  BookValuePerShare: string | null;
  TotalAssets: string | null;
  Equity: string | null;
  EquityToAssetRatio: string | null;
  ResultDividendPerShareAnnual: string | null;
  ForecastDividendPerShareAnnual: string | null;
  ForecastNetSales: string | null;
  ForecastOperatingProfit: string | null;
  ForecastProfit: string | null;
  ForecastEarningsPerShare: string | null;
}

export interface JqBar {
  Date: string;
  Code: string;
  Open: number | null;
  High: number | null;
  Low: number | null;
  Close: number | null;
  Volume: number | null;
  AdjustmentClose: number | null;
}

// ── API呼び出し ───────────────────────────────────────────────────────────────

/** 全上場銘柄マスタ */
export async function fetchEquitiesMaster(): Promise<JqEquity[]> {
  const data = await jquantsGet<{ equities: JqEquity[] }>("/equities/master");
  return data.equities ?? [];
}

/** 単一銘柄の財務情報サマリー（通期のみ） */
export async function fetchFinSummary(code: string): Promise<JqFinSummary[]> {
  const data = await jquantsGet<{ fins_summary: JqFinSummary[] }>(
    "/fins/summary",
    { code }
  );
  const all = data.fins_summary ?? [];
  // 通期決算のみ（FY / Annual）
  return all.filter(
    (s) =>
      s.TypeOfCurrentPeriod === "FY" ||
      (s.TypeOfDocument?.includes("Annual") ?? false)
  );
}

/** 単一銘柄の最新株価 */
export async function fetchLatestBar(code: string): Promise<JqBar | null> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 10); // 直近10日で直近営業日をカバー
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const data = await jquantsGet<{ bars: JqBar[] }>("/equities/bars/daily", {
    code,
    date_from: fmt(from),
    date_to: fmt(today),
  });
  const bars = data.bars ?? [];
  return bars.length > 0 ? bars[bars.length - 1] : null;
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
  equityRatio: number | null;
  operatingMargin: number | null;
  dividendYield: number | null;
  revenueGrowthYoy: number | null;
  netSales: number | null;
  operatingProfit: number | null;
  totalAssets: number | null;
  equity: number | null;
  growthFlag: "急成長（要注意）" | "安定成長" | "横ばい" | "縮小中" | null;
  valueFlag: "優良バリュー" | "急成長警戒" | "低収益放置" | "高収益割安" | null;
}

function n(s: string | null | undefined): number | null {
  if (s == null || s === "") return null;
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

export function calcMetrics(
  equity: JqEquity,
  summaries: JqFinSummary[],
  bar: JqBar | null
): ScreenerMetrics {
  const base: ScreenerMetrics = {
    code: equity.Code,
    name: equity.CompanyName,
    market: equity.MarketCodeName,
    sector: equity.Sector33CodeName,
    price: bar?.AdjustmentClose ?? bar?.Close ?? null,
    pbr: null, per: null, roe: null, roa: null,
    equityRatio: null, operatingMargin: null,
    dividendYield: null, revenueGrowthYoy: null,
    netSales: null, operatingProfit: null,
    totalAssets: null, equity: null,
    growthFlag: null, valueFlag: null,
  };

  if (summaries.length === 0) return base;

  const sorted = [...summaries].sort((a, b) =>
    b.CurrentFiscalYearEndDate.localeCompare(a.CurrentFiscalYearEndDate)
  );
  const latest = sorted[0];
  const prev = sorted[1] ?? null;

  const price = base.price;
  const eq = n(latest.Equity);
  const ta = n(latest.TotalAssets);
  const sales = n(latest.NetSales);
  const op = n(latest.OperatingProfit);
  const eps = n(latest.EarningsPerShare);
  const bvps = n(latest.BookValuePerShare);
  const eqRatio = n(latest.EquityToAssetRatio);
  const div = n(latest.ResultDividendPerShareAnnual) ?? n(latest.ForecastDividendPerShareAnnual);
  const prevSales = prev ? n(prev.NetSales) : null;

  base.netSales = sales;
  base.operatingProfit = op;
  base.totalAssets = ta;
  base.equity = eq;

  // 自己資本比率（0〜1に正規化）
  if (eqRatio !== null) {
    base.equityRatio = eqRatio > 1 ? eqRatio / 100 : eqRatio;
  } else if (eq !== null && ta !== null && ta > 0) {
    base.equityRatio = eq / ta;
  }

  // 営業利益率
  if (op !== null && sales !== null && sales > 0) {
    base.operatingMargin = op / sales;
  }

  // ROA（営業利益 / 総資産）
  if (op !== null && ta !== null && ta > 0) {
    base.roa = op / ta;
  }

  // 売上成長率
  if (sales !== null && prevSales !== null && prevSales > 0) {
    base.revenueGrowthYoy = (sales - prevSales) / prevSales;
  }

  if (price !== null && price > 0) {
    if (bvps !== null && bvps > 0) base.pbr = price / bvps;
    if (eps !== null && eps > 0) base.per = price / eps;
    if (eps !== null && bvps !== null && bvps > 0) base.roe = eps / bvps;
    if (div !== null && div > 0) base.dividendYield = div / price;
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
  const { pbr, equityRatio: eqR, roe: r, per, operatingMargin: om } = base;
  const growth = base.revenueGrowthYoy ?? 0;
  const eqRVal = eqR ?? 0;

  if (pbr !== null && pbr <= 0.5 && eqRVal >= 0.6 && r !== null && r >= 0.05) {
    base.valueFlag = "優良バリュー";
  } else if (growth > 0.20 && eqRVal < 0.5) {
    base.valueFlag = "急成長警戒";
  } else if (pbr !== null && pbr <= 0.5 && r !== null && r < 0.03) {
    base.valueFlag = "低収益放置";
  } else if (per !== null && per <= 12 && om !== null && om >= 0.15) {
    base.valueFlag = "高収益割安";
  }

  return base;
}
