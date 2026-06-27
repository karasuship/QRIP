const BASE = "https://api.jquants.com/v2";

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

function toCode5(code: string): string {
  return code.length === 4 ? code + "0" : code;
}

// ── 型定義（V2実レスポンスに基づく） ────────────────────────────────────────

export interface JqEquity {
  Date: string;
  Code: string;     // 5桁 例: "94320"
  CoName: string;
  CoNameEn: string;
  S17: string;
  S17Nm: string;
  S33: string;
  S33Nm: string;
  ScaleCat: string;
  Mkt: string;
  MktNm: string;
}

export interface JqFinSummary {
  DiscDate: string;
  Code: string;
  DocType: string;
  CurPerType: string;     // "FY" = 通期
  CurFYSt: string;
  CurFYEn: string;
  Sales: string | null;   // 売上高
  OP: string | null;      // 営業利益
  OdP: string | null;     // 経常利益
  NP: string | null;      // 純利益
  EPS: string | null;
  DEPS: string | null;
  TA: string | null;      // 総資産
  Eq: string | null;      // 純資産
  EqAR: string | null;    // 自己資本比率（0〜1）
  BPS: string | null;     // 1株純資産
  CFO: string | null;
  CFI: string | null;
  CFF: string | null;
  DivAnn: string | null;  // 年間配当（実績）
  FDivAnn: string | null; // 年間配当（予想）
  FSales: string | null;  // 予想売上高
  FOP: string | null;     // 予想営業利益
}

export interface JqBar {
  Date: string;
  Code: string;
  O: number | null;     // 始値
  H: number | null;     // 高値
  L: number | null;     // 安値
  C: number | null;     // 終値
  Vo: number | null;    // 出来高
  Va: number | null;    // 売買代金
  AdjFactor: number | null;
  AdjO: number | null;
  AdjH: number | null;
  AdjL: number | null;
  AdjC: number | null;  // 調整済み終値
  AdjVo: number | null;
}

// ── API呼び出し ───────────────────────────────────────────────────────────────

export async function fetchEquitiesMaster(): Promise<JqEquity[]> {
  const data = await jquantsGet<{ data: JqEquity[] }>("/equities/master");
  return data.data ?? [];
}

export async function fetchFinSummary(code: string, fyOnly = true): Promise<JqFinSummary[]> {
  const data = await jquantsGet<{ data: JqFinSummary[] }>(
    "/fins/summary",
    { code: toCode5(code) }
  );
  if (fyOnly) return (data.data ?? []).filter((s) => s.CurPerType === "FY");
  return data.data ?? [];
}

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

/** 全銘柄の直近株価を1リクエストで取得（コード指定なし → 当日全件返す） */
export async function fetchAllBarsForDate(date: string): Promise<Map<string, JqBar>> {
  const map = new Map<string, JqBar>();
  try {
    const data = await jquantsGet<{ data: JqBar[] }>("/equities/bars/daily", { date });
    for (const bar of data.data ?? []) {
      map.set(bar.Code, bar);
    }
  } catch {
    // 非対応プランの場合は空Mapを返す（fallbackは個別取得に任せる）
  }
  return map;
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
  bps: number | null;
  eps: number | null;
  divAnn: number | null;
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
    price: bar?.AdjC ?? bar?.C ?? null,
    pbr: null, per: null, roe: null, roa: null,
    equityRatio: null, operatingMargin: null,
    dividendYield: null, revenueGrowthYoy: null,
    netSales: null, operatingProfit: null,
    totalAssets: null, equity: null,
    bps: null, eps: null, divAnn: null,
    growthFlag: null, valueFlag: null,
  };

  if (summaries.length === 0) return base;

  const sorted = [...summaries].sort((a, b) => b.CurFYEn.localeCompare(a.CurFYEn));
  const latest = sorted[0];
  const prev = sorted[1] ?? null;

  const price = base.price;
  const equity = n(latest.Eq);
  const ta = n(latest.TA);
  const sales = n(latest.Sales);
  const op = n(latest.OP);
  const eps = n(latest.EPS);
  const bps = n(latest.BPS);
  const eqAR = n(latest.EqAR);
  const div = n(latest.DivAnn) ?? n(latest.FDivAnn);
  const prevSales = prev ? n(prev.Sales) : null;

  base.netSales = sales;
  base.operatingProfit = op;
  base.totalAssets = ta;
  base.equity = equity;

  // 自己資本比率（EqARは0〜1で格納）
  base.equityRatio = eqAR ?? (equity !== null && ta !== null && ta > 0 ? equity / ta : null);

  if (op !== null && sales !== null && sales > 0) base.operatingMargin = op / sales;
  if (op !== null && ta !== null && ta > 0) base.roa = op / ta;
  if (sales !== null && prevSales !== null && prevSales > 0) {
    base.revenueGrowthYoy = (sales - prevSales) / prevSales;
  }

  base.bps = bps;
  base.eps = eps;
  base.divAnn = div;

  // ROE = EPS/BPS（株価不要）
  if (eps !== null && bps !== null && bps > 0) base.roe = eps / bps;

  if (price !== null && price > 0) {
    if (bps !== null && bps > 0) base.pbr = price / bps;
    if (eps !== null && eps > 0) base.per = price / eps;
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
