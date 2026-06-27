const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export interface YahooCreds { cookie: string; crumb: string }

export async function getYahooCreds(): Promise<YahooCreds | null> {
  try {
    const r1 = await fetch("https://finance.yahoo.com/", {
      headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
      redirect: "follow",
    });
    const rawCookie = r1.headers.get("set-cookie") ?? "";
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

// ── バッチ株価取得（screener-prices cron 用） ─────────────────────────────────

export interface YahooQuote {
  price: number;
  high52: number | null;
  low52: number | null;
}

export async function fetchPricesYahoo(
  codes5: string[],
  creds?: YahooCreds | null
): Promise<Map<string, YahooQuote>> {
  const map = new Map<string, YahooQuote>();
  if (codes5.length === 0) return map;

  const symbolToCode = new Map<string, string>();
  for (const c of codes5) symbolToCode.set(c.slice(0, 4) + ".T", c);

  const params = new URLSearchParams({
    symbols: [...symbolToCode.keys()].join(","),
    fields: "regularMarketPrice,fiftyTwoWeekHigh,fiftyTwoWeekLow",
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
    if (price != null && code5) {
      map.set(code5, {
        price,
        high52: (q.fiftyTwoWeekHigh as number | null) ?? null,
        low52:  (q.fiftyTwoWeekLow  as number | null) ?? null,
      });
    }
  }
  return map;
}

// ── 個別銘柄ページ用（on-demand・24h キャッシュ） ────────────────────────────

export interface StockCalendar {
  nextEarningsDate: string | null;
  exDivDate: string | null;
  divDate: string | null;
}

export async function fetchCalendarEvents(
  code4T: string,
  creds?: YahooCreds | null
): Promise<StockCalendar> {
  const empty: StockCalendar = { nextEarningsDate: null, exDivDate: null, divDate: null };
  try {
    const headers: Record<string, string> = { "User-Agent": UA };
    if (creds?.cookie) headers["Cookie"] = creds.cookie;
    const params = new URLSearchParams({ modules: "calendarEvents" });
    if (creds?.crumb) params.set("crumb", creds.crumb);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${code4T}?${params}`,
      { headers, next: { revalidate: 86400 } }
    );
    if (!res.ok) return empty;

    const data = await res.json();
    const ce = data?.quoteSummary?.result?.[0]?.calendarEvents;
    const earningsDates: { raw: number }[] = ce?.earnings?.earningsDate ?? [];
    const nextEarnings = earningsDates.length > 0
      ? new Date(earningsDates[0].raw * 1000).toISOString().slice(0, 10)
      : null;
    const exDiv = ce?.exDividendDate?.raw
      ? new Date(ce.exDividendDate.raw * 1000).toISOString().slice(0, 10)
      : null;
    const div = ce?.dividendDate?.raw
      ? new Date(ce.dividendDate.raw * 1000).toISOString().slice(0, 10)
      : null;
    return { nextEarningsDate: nextEarnings, exDivDate: exDiv, divDate: div };
  } catch {
    return empty;
  }
}

export interface DividendEvent {
  date: string;
  amount: number;
}

export interface ChartData {
  dividends: DividendEvent[];
  change1m: number | null;
  change3m: number | null;
  change1y: number | null;
}

export async function fetchChartData(
  code4T: string,
  creds?: YahooCreds | null
): Promise<ChartData> {
  const empty: ChartData = { dividends: [], change1m: null, change3m: null, change1y: null };
  try {
    const headers: Record<string, string> = { "User-Agent": UA };
    if (creds?.cookie) headers["Cookie"] = creds.cookie;
    const params = new URLSearchParams({ range: "2y", interval: "1mo", events: "div" });
    if (creds?.crumb) params.set("crumb", creds.crumb);

    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code4T}?${params}`,
      { headers, next: { revalidate: 86400 } }
    );
    if (!res.ok) return empty;

    const data = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result) return empty;

    // 配当履��
    const divEvents: Record<string, { amount: number; date: number }> =
      result.events?.dividends ?? {};
    const dividends: DividendEvent[] = Object.values(divEvents)
      .map((d) => ({ date: new Date(d.date * 1000).toISOString().slice(0, 10), amount: d.amount }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 騰落率
    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const current = [...closes].reverse().find((c) => c != null) ?? null;
    if (!current) return { dividends, change1m: null, change3m: null, change1y: null };

    const now = Date.now() / 1000;
    function priceAt(monthsAgo: number): number | null {
      const target = now - monthsAgo * 30.44 * 86400;
      let best: number | null = null, bestDiff = Infinity;
      for (let i = 0; i < timestamps.length; i++) {
        const diff = Math.abs(timestamps[i] - target);
        if (diff < bestDiff && closes[i] != null) { bestDiff = diff; best = closes[i]; }
      }
      return best;
    }

    const p1m = priceAt(1), p3m = priceAt(3), p1y = priceAt(12);
    return {
      dividends,
      change1m: p1m ? (current - p1m) / p1m : null,
      change3m: p3m ? (current - p3m) / p3m : null,
      change1y: p1y ? (current - p1y) / p1y : null,
    };
  } catch {
    return empty;
  }
}
