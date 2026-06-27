const BASE = "https://api.jquants.com/v2";

// ── 汎用フェッチ ─────────────────────────────────────────────────────────────

async function jquantsGet<T>(path: string, params?: Record<string, string>): Promise<T> {
  const apiKey = process.env.JQUANTS_API_KEY;
  if (!apiKey) throw new Error("JQUANTS_API_KEY が未設定");

  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`J-Quants ${path} failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<T>;
}

// 4桁コード → 5桁（末尾0）に正規化
function toCode5(code: string): string {
  return code.length === 4 ? code + "0" : code;
}

// ── 型定義（実際のV2レスポンスに合わせる） ───────────────────────────────────

export interface JqEquity {
  Date: string;
  Code: string;       // 5桁 例: "94320"
  CoName: string;
  CoNameEn: string;
  S17: string;
  S17Nm: string;
  S33: string;
  S33Nm: string;
  ScaleCat: string;
  Mkt: string;
  MktNm: string;
  Mrgn: string;
  MrgnNm: string;
  ProdCat: string;
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

/** 全上場銘柄マスタ（レスポンスキー: data） */
export async function fetchEquitiesMaster(): Promise<JqEquity[]> {
  const data = await jquantsGet<{ data: JqEquity[] }>("/equities/master");
  return data.data ?? [];
}

/** 単一銘柄の財務情報サマリー（通期のみ） */
export async function fetchFinSummary(code: string): Promise<JqFinSummary[]> {
  const data = await jquantsGet<{ data: JqFinSummary[] }>(
    "/fins/summary",
    { code: toCode5(code) }
  );
  const all = data.data ?? [];
  return all.filter(
    (s) => s.TypeOfCurrentPeriod === "FY" || (s.TypeOfDocument?.includes("Annual") ?? false)
  );
}

/** 単一銘柄の最新株価 */
export async function fetchLatestBar(code: string): Promise<JqBar | null> {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 10);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const data = await jquantsGet<{ data: JqBar[] }>("/equities/bars/daily", {
    code: toCode5(code),
    date_from: fmt(from),
    date_to: fmt(today),
  });
  const bars = data.data ?? [];
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
  eq: JqEquity,
  summaries: JqFinSummary[],
  bar: JqBar | null
): ScreenerMetrics {
  const base: ScreenerMetrics = {
    code: eq.Code,
    name: eq.CoName,
    market: eq.MktNm,
    sector: eq.S33Nm,
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
  const equity = n(latest.Equity);
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
  base.equity = equity;

  if (eqRatio !== null) {
    base.equityRatio = eqRatio > 1 ? eqRatio / 100 : eqRatio;
  } else if (equity !== null && ta !== null && ta > 0) {
    base.equityRatio = equity / ta;
  }

  if (op !== null && sales !== null && sales > 0) base.operatingMargin = op / sales;
  if (op !== null && ta !== null && ta > 0) base.roa = op / ta;
  if (sales !== null && prevSales !== null && prevSales > 0) {
    base.revenueGrowthYoy = (sales - prevSales) / prevSales;
  }

  if (price !== null && price > 0) {
    if (bvps !== null && bvps > 0) base.pbr = price / bvps;
    if (eps !== null && eps > 0) base.per = price / eps;
    if (eps !== null && bvps !== null && bvps > 0) base.roe = eps / bvps;
    if (div !== null && div > 0) base.dividendYield = div / price;
  }

  const g = base.revenueGrowthYoy;
  if (g !== null) {
    if (g > 0.20) base.growthFlag = "急成長（要注意）";
    else if (g >= 0.05) base.growthFlag = "安定成長";
    else if (g >= 0) base.growthFlag = "横ばい";
    else base.growthFlag = "縮小中";
  }

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
