const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

interface YahooCreds { cookie: string; crumb: string }

/** Yahoo Finance のセッション認証（クッキー + クランブ）を取得 */
export async function getYahooCreds(): Promise<YahooCreds | null> {
  try {
    const r1 = await fetch("https://finance.yahoo.com/", {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    // set-cookie をひとつの文字列として取り出す
    const rawCookie = r1.headers.get("set-cookie") ?? "";
    // Node.js の fetch では set-cookie がカンマ区切りで返ることがある
    const cookie = rawCookie.split(/,(?=[^;]+=[^;]+)/)[0]?.split(";")[0] ?? "";

    const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, "Cookie": cookie },
    });
    if (!r2.ok) return null;
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.startsWith("<")) return null;

    return { cookie, crumb };
  } catch {
    return null;
  }
}

/**
 * 最大100銘柄の現在株価を一括取得。
 * codes5: 5桁コードの配列
 */
export async function fetchPricesYahoo(
  codes5: string[],
  creds?: YahooCreds | null
): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (codes5.length === 0) return map;

  const symbolToCode = new Map<string, string>();
  for (const c of codes5) symbolToCode.set(c.slice(0, 4) + ".T", c);

  const params = new URLSearchParams({
    symbols: [...symbolToCode.keys()].join(","),
    fields: "regularMarketPrice",
  });
  if (creds?.crumb) params.set("crumb", creds.crumb);

  const headers: Record<string, string> = { "User-Agent": UA };
  if (creds?.cookie) headers["Cookie"] = creds.cookie;

  const res = await fetch(
    `https://query1.finance.yahoo.com/v7/finance/quote?${params}`,
    { headers, next: { revalidate: 0 } }
  );

  if (!res.ok) throw new Error(`Yahoo Finance ${res.status}`);

  const data = await res.json();
  for (const q of data?.quoteResponse?.result ?? []) {
    const price = q.regularMarketPrice as number | null;
    const code5 = symbolToCode.get(q.symbol as string);
    if (price != null && code5) map.set(code5, price);
  }

  return map;
}
