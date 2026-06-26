/**
 * NTT (9432) 配当利回りシグナル
 * decisions/0033: 利回り ≥ 3.5% AND 52週下位20% → BUY
 *                 利回り ≤ 3.0% OR  52週上位80% → SELL
 *
 * 根拠: 26年バックテスト Z=1.88, 利回り3.5%時12ヶ月平均+24.6%
 */

// 年間配当（¥/株）。配当変更時はここを更新する。
const NTT_ANNUAL_DIV = 5.30;

export type NttSignalType = "BUY" | "SELL" | "HOLD";

export interface NttSignal {
  date: string;
  price: number;
  divYield: number;       // 小数 (e.g. 0.0369)
  w52Hi: number;
  w52Lo: number;
  w52Pos: number;         // 0.0〜1.0（52週レンジ内位置）
  signal: NttSignalType;
  annualDiv: number;
}

async function fetchNttPrice(): Promise<[string[], number[]] | null> {
  const url =
    "https://query1.finance.yahoo.com/v8/finance/chart/9432.T?range=1y&interval=1d";
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
    // raw close（分割・配当調整なし）を使う
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

export async function fetchNttSignal(): Promise<NttSignal | null> {
  const result = await fetchNttPrice();
  if (!result) return null;

  const [dates, vals] = result;
  const n = vals.length;
  if (n < 10) return null;

  const price = vals[n - 1];
  const date  = dates[n - 1];

  const w52Hi = Math.max(...vals);
  const w52Lo = Math.min(...vals);
  const w52Pos = w52Hi > w52Lo ? (price - w52Lo) / (w52Hi - w52Lo) : 0.5;

  const divYield = NTT_ANNUAL_DIV / price;

  let signal: NttSignalType;
  if (divYield >= 0.035 && w52Pos <= 0.20) {
    signal = "BUY";
  } else if (divYield <= 0.030 || w52Pos >= 0.80) {
    signal = "SELL";
  } else {
    signal = "HOLD";
  }

  return { date, price, divYield, w52Hi, w52Lo, w52Pos, signal, annualDiv: NTT_ANNUAL_DIV };
}
