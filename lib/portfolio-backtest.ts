export interface PortfolioAsset {
  ticker: string;
  weight: number;
}

export interface PatternDef {
  id: string;
  name: string;
  tag: string;
  tagCls: string;
  assets: PortfolioAsset[];
  note: string;
  backtestMode?: "dca" | "jp_signal";
}

export interface BacktestResult {
  returnPct: number;         // 元本比リターン %
  annualizedReturn: number;  // 年換算 %
  vsVoo: number;             // VOO との差 (pp)
  months: number;            // 対象期間（月）
  activatedMonths?: number;  // シグナル型：実際に投資した月数
  ok: boolean;
}

// ── JP シグナル設定 ────────────────────────────────────────────────────────────
// decisions/0033 で採用された配当利回りシグナルのパラメータ

const JP_SIGNAL_CONFIGS = [
  { ticker: "9432.T", annualDiv: 5.30,  buyYield: 0.035 },
  { ticker: "2914.T", annualDiv: 188.0, buyYield: 0.055 },
  { ticker: "9433.T", annualDiv: 145.0, buyYield: 0.035 },
] as const;

// ── ポートフォリオパターン定義 ────────────────────────────────────────────────

export const PORTFOLIO_PATTERNS: PatternDef[] = [
  {
    id: "sp500",
    name: "全米インデックス",
    tag: "市場平均",
    tagCls: "border-[#38bdf8]/25 bg-[#38bdf8]/[0.06] text-[#38bdf8]",
    assets: [{ ticker: "VOO", weight: 1.0 }],
    note: "S&P500に連動するVOO。比較の基準。",
  },
  {
    id: "growth",
    name: "成長重視",
    tag: "高リターン・高リスク",
    tagCls: "border-violet-400/25 bg-violet-400/[0.06] text-violet-300",
    assets: [
      { ticker: "QQQ", weight: 0.6 },
      { ticker: "VOO", weight: 0.4 },
    ],
    note: "ナスダック100（QQQ）60% + S&P500 40%。テック偏重。",
  },
  {
    id: "balance",
    name: "推奨バランス",
    tag: "分散・バランス",
    tagCls: "border-[#34d399]/25 bg-[#34d399]/[0.06] text-[#34d399]",
    assets: [
      { ticker: "VOO", weight: 0.5 },
      { ticker: "QQQ", weight: 0.2 },
      { ticker: "VEA", weight: 0.2 },
      { ticker: "VWO", weight: 0.1 },
    ],
    note: "QRIP推奨。米国50%+ナスダック20%+先進国20%+新興国10%。",
  },
  {
    id: "world",
    name: "全世界分散",
    tag: "最大分散",
    tagCls: "border-amber-400/25 bg-amber-400/[0.06] text-amber-400",
    assets: [{ ticker: "VT", weight: 1.0 }],
    note: "全世界株式VT。オルカンに相当。リスクを最大限に分散。",
  },
  {
    id: "jp_signal",
    name: "配当シグナル型",
    tag: "QRIP検証済み",
    tagCls: "border-[#34d399]/25 bg-[#34d399]/[0.06] text-[#34d399]",
    assets: JP_SIGNAL_CONFIGS.map(({ ticker }) => ({ ticker, weight: 1 / 3 })),
    note: "BUY信号が出た月のみ均等投資。HOLD/SELL月は現金保持。decisions/0033。",
    backtestMode: "jp_signal",
  },
  {
    id: "jp_blind",
    name: "配当盲目DCA",
    tag: "信号無視",
    tagCls: "border-slate-400/25 bg-slate-400/[0.06] text-slate-400",
    assets: JP_SIGNAL_CONFIGS.map(({ ticker }) => ({ ticker, weight: 1 / 3 })),
    note: "NTT/JT/KDDIに毎月均等積立。シグナル連動型との対照実験。",
  },
];

// ── データ取得 ────────────────────────────────────────────────────────────────

async function fetchYahoo(
  ticker: string,
  range: string,
  interval: string
): Promise<{ timestamps: number[]; closes: (number | null)[] } | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;
    return {
      timestamps: result.timestamp ?? [],
      closes:
        result.indicators?.adjclose?.[0]?.adjclose ??
        result.indicators?.quote?.[0]?.close ??
        [],
    };
  } catch {
    return null;
  }
}

async function fetchMonthly(
  ticker: string,
  range = "1y"
): Promise<{ dates: string[]; closes: number[] } | null> {
  const raw = await fetchYahoo(ticker, range, "1mo");
  if (!raw) return null;
  const dates: string[] = [];
  const closes: number[] = [];
  for (let i = 0; i < raw.timestamps.length; i++) {
    const v = raw.closes[i];
    if (v != null && !isNaN(v) && v > 0) {
      dates.push(new Date(raw.timestamps[i] * 1000).toISOString().slice(0, 7));
      closes.push(v);
    }
  }
  return dates.length >= 3 ? { dates, closes } : null;
}

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  const raw = await fetchYahoo(ticker, "5d", "1d");
  if (!raw) return null;
  for (let i = raw.closes.length - 1; i >= 0; i--) {
    const v = raw.closes[i];
    if (v != null && !isNaN(v) && v > 0) return v;
  }
  return null;
}

// ── DCA バックテスト ──────────────────────────────────────────────────────────

const MONTHLY_JPY = 30_000;

const FAIL: BacktestResult = {
  returnPct: 0, annualizedReturn: 0, vsVoo: 0, months: 0, ok: false,
};

async function backtestDca(pattern: PatternDef): Promise<BacktestResult> {
  const [monthlyResults, currentPrices] = await Promise.all([
    Promise.all(pattern.assets.map(async ({ ticker }) => ({
      ticker,
      data: await fetchMonthly(ticker),
    }))),
    Promise.all(pattern.assets.map(async ({ ticker }) => ({
      ticker,
      price: await fetchCurrentPrice(ticker),
    }))),
  ]);

  const monthlyMap = new Map(monthlyResults.map(({ ticker, data }) => [ticker, data]));
  const currentMap = new Map(currentPrices.map(({ ticker, price }) => [ticker, price]));

  if ([...monthlyMap.values()].some((d) => !d) || [...currentMap.values()].some((p) => !p)) {
    return FAIL;
  }

  const monthSets = pattern.assets.map(({ ticker }) => new Set(monthlyMap.get(ticker)!.dates));
  const commonMonths = [...monthSets[0]]
    .filter((m) => monthSets.every((s) => s.has(m)))
    .sort();

  const n = commonMonths.length;
  if (n < 3) return FAIL;

  let totalInvested = 0;
  let totalCurrentValue = 0;

  for (const { ticker, weight } of pattern.assets) {
    const data = monthlyMap.get(ticker)!;
    const priceMap = new Map(data.dates.map((d, i) => [d, data.closes[i]]));
    const nowPrice = currentMap.get(ticker)!;

    let units = 0;
    for (const month of commonMonths) {
      const buyPrice = priceMap.get(month);
      if (!buyPrice) continue;
      const invested = MONTHLY_JPY * weight;
      units += invested / buyPrice;
      totalInvested += invested;
    }
    totalCurrentValue += units * nowPrice;
  }

  if (totalInvested === 0) return FAIL;

  const ratio = totalCurrentValue / totalInvested;
  const years = n / 12;

  return {
    returnPct: (ratio - 1) * 100,
    annualizedReturn: (Math.pow(ratio, 1 / years) - 1) * 100,
    vsVoo: 0,
    months: n,
    ok: true,
  };
}

// ── JP シグナル連動バックテスト ───────────────────────────────────────────────
// 各月に BUY 信号が出ている銘柄のみに均等投資。HOLD/SELL 月は現金保持。
// 52週高安は2年分の月次データからローリング計算。

async function backtestJpSignal(): Promise<BacktestResult> {
  const tickers = JP_SIGNAL_CONFIGS.map((c) => c.ticker);

  const [monthlyResults, currentPrices] = await Promise.all([
    Promise.all(tickers.map(async (ticker) => ({
      ticker,
      data: await fetchMonthly(ticker, "2y"), // 52週計算に2年分必要
    }))),
    Promise.all(tickers.map(async (ticker) => ({
      ticker,
      price: await fetchCurrentPrice(ticker),
    }))),
  ]);

  const monthlyMap = new Map(monthlyResults.map(({ ticker, data }) => [ticker, data]));
  const currentMap = new Map(currentPrices.map(({ ticker, price }) => [ticker, price]));

  if ([...monthlyMap.values()].some((d) => !d) || [...currentMap.values()].some((p) => !p)) {
    return FAIL;
  }

  // 全銘柄共通の月（過去24ヶ月以内）
  const monthSets = tickers.map((t) => new Set(monthlyMap.get(t)!.dates));
  const allMonths = [...monthSets[0]]
    .filter((m) => monthSets.every((s) => s.has(m)))
    .sort();

  // 直近12ヶ月を投資対象期間とする
  const investMonths = allMonths.slice(-12);
  if (investMonths.length < 3) return FAIL;

  let totalInvested = 0;
  let totalCurrentValue = 0;
  let activatedMonths = 0;

  for (const month of investMonths) {
    const monthIdx = allMonths.indexOf(month);

    // 各銘柄の BUY 判定
    const buyTickers = JP_SIGNAL_CONFIGS.filter(({ ticker, annualDiv, buyYield }) => {
      const data = monthlyMap.get(ticker)!;
      const priceMap = new Map(data.dates.map((d, i) => [d, data.closes[i]]));
      const price = priceMap.get(month);
      if (!price) return false;

      // 52週高安：当月を含む直近12ヶ月
      const window = allMonths
        .slice(Math.max(0, monthIdx - 11), monthIdx + 1)
        .map((m) => priceMap.get(m) ?? 0)
        .filter((p) => p > 0);

      if (window.length < 3) return false;

      const hi = Math.max(...window);
      const lo = Math.min(...window);
      const w52Pos = hi > lo ? (price - lo) / (hi - lo) : 0.5;
      const divYield = annualDiv / price;

      return divYield >= buyYield && w52Pos <= 0.2;
    });

    if (buyTickers.length === 0) continue; // 現金保持月

    activatedMonths++;
    const perStock = MONTHLY_JPY / buyTickers.length;

    for (const { ticker } of buyTickers) {
      const data = monthlyMap.get(ticker)!;
      const priceMap = new Map(data.dates.map((d, i) => [d, data.closes[i]]));
      const buyPrice = priceMap.get(month)!;
      const nowPrice = currentMap.get(ticker)!;

      const units = perStock / buyPrice;
      totalInvested += perStock;
      totalCurrentValue += units * nowPrice;
    }
  }

  if (totalInvested === 0) {
    // 1年間一度も BUY が出なかった → 現金保持（リターン 0%）
    return {
      returnPct: 0,
      annualizedReturn: 0,
      vsVoo: 0,
      months: investMonths.length,
      activatedMonths: 0,
      ok: true,
    };
  }

  const ratio = totalCurrentValue / totalInvested;
  const years = investMonths.length / 12;

  return {
    returnPct: (ratio - 1) * 100,
    annualizedReturn: (Math.pow(ratio, 1 / years) - 1) * 100,
    vsVoo: 0,
    months: investMonths.length,
    activatedMonths,
    ok: true,
  };
}

// ── 全パターン一括実行 ────────────────────────────────────────────────────────

export async function backtestPortfolio(pattern: PatternDef): Promise<BacktestResult> {
  if (pattern.backtestMode === "jp_signal") return backtestJpSignal();
  return backtestDca(pattern);
}

export async function backtestAllPatterns(): Promise<Map<string, BacktestResult>> {
  const results = await Promise.all(
    PORTFOLIO_PATTERNS.map(async (p) => {
      const r = await backtestPortfolio(p).catch(() => FAIL);
      return [p.id, r] as [string, BacktestResult];
    })
  );

  const map = new Map(results);

  // VOO を基準に vsVoo を計算
  const voo = map.get("sp500");
  if (voo?.ok) {
    for (const [id, r] of map) {
      if (id !== "sp500" && r.ok) {
        r.vsVoo = r.returnPct - voo.returnPct;
      }
    }
  }

  return map;
}
