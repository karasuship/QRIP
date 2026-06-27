const BASE = "https://query1.finance.yahoo.com";

/** 5桁コード → Yahoo Finance シンボル (e.g. "94320" → "9432.T") */
function toSymbol(code5: string): string {
  return code5.slice(0, 4) + ".T";
}

/**
 * 最大100銘柄の現在株価を一括取得。
 * codes5: 5桁コードの配列
 * 戻り値: code5 → 株価 のMap
 */
export async function fetchPricesYahoo(codes5: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codes5.length === 0) return map;

  const symbolToCode = new Map<string, string>();
  for (const c of codes5) symbolToCode.set(toSymbol(c), c);

  const symbols = [...symbolToCode.keys()].join(",");
  const url = `${BASE}/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&fields=regularMarketPrice`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; QRIP/1.0)" },
    next: { revalidate: 0 },
  });

  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);

  const data = await res.json();
  for (const q of data?.quoteResponse?.result ?? []) {
    const price = q.regularMarketPrice as number | null;
    const code5 = symbolToCode.get(q.symbol as string);
    if (price != null && code5) map.set(code5, price);
  }

  return map;
}
