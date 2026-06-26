/**
 * 日本高配当株 シグナルエンジン（汎用）
 * decisions/0033 の NTT から拡張
 *
 * 買い条件: 配当利回り ≥ buyYield AND 52週下位 20%
 * 売り条件: 配当利回り ≤ sellYield OR 52週上位 80%
 */

export type JpSignalType = "BUY" | "SELL" | "HOLD";

export interface JpStockConfig {
  code: string;       // 証券コード e.g. "9432"
  name: string;       // 略称 e.g. "NTT"
  fullName: string;   // 正式名称
  annualDiv: number;  // 年間配当 ¥/株（変更時に更新）
  buyYield: number;   // BUY 閾値（利回り小数）
  sellYield: number;  // SELL 閾値（利回り小数）
}

export const JP_STOCKS: JpStockConfig[] = [
  {
    code: "9432", name: "NTT",  fullName: "日本電信電話",
    annualDiv: 5.30,  buyYield: 0.035, sellYield: 0.030,
  },
  {
    code: "2914", name: "JT",   fullName: "日本たばこ産業",
    annualDiv: 188.0, buyYield: 0.055, sellYield: 0.045,
    // JT: 26年統計で過剰落ちアルファは棄却(R44)。利回りベース判断のみ有効
  },
  {
    code: "9433", name: "KDDI", fullName: "KDDI",
    annualDiv: 145.0, buyYield: 0.035, sellYield: 0.028,
  },
];

export interface JpStockSignal extends JpStockConfig {
  date: string;
  price: number;
  divYield: number;
  w52Hi: number;
  w52Lo: number;
  w52Pos: number;   // 0.0〜1.0
  signal: JpSignalType;
}

async function fetchPrice(code: string): Promise<[string[], number[]] | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${code}.T?range=1y&interval=1d`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 900 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return null;

    const ts: number[] = result.timestamp ?? [];
    const raw: (number | null)[] =
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
    return dates.length > 0 ? [dates, vals] : null;
  } catch {
    return null;
  }
}

async function fetchOne(cfg: JpStockConfig): Promise<JpStockSignal | null> {
  const result = await fetchPrice(cfg.code);
  if (!result) return null;

  const [dates, vals] = result;
  const n = vals.length;
  if (n < 10) return null;

  const price  = vals[n - 1];
  const date   = dates[n - 1];
  const w52Hi  = Math.max(...vals);
  const w52Lo  = Math.min(...vals);
  const w52Pos = w52Hi > w52Lo ? (price - w52Lo) / (w52Hi - w52Lo) : 0.5;
  const divYield = cfg.annualDiv / price;

  let signal: JpSignalType;
  if (divYield >= cfg.buyYield && w52Pos <= 0.20) {
    signal = "BUY";
  } else if (divYield <= cfg.sellYield || w52Pos >= 0.80) {
    signal = "SELL";
  } else {
    signal = "HOLD";
  }

  return { ...cfg, date, price, divYield, w52Hi, w52Lo, w52Pos, signal };
}

export async function fetchJpStockSignals(): Promise<JpStockSignal[]> {
  const results = await Promise.allSettled(JP_STOCKS.map(fetchOne));
  return results
    .filter((r): r is PromiseFulfilledResult<JpStockSignal | null> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((v): v is JpStockSignal => v !== null);
}

// decisions/0033 との後方互換（cron で使用中）
export { fetchJpStockSignals as fetchNttSignal };
export type { JpStockSignal as NttSignal };
