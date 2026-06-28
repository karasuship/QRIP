export interface Headline {
  title: string;
  description: string;
  source: string;
  pubDate: string;
}

// ── Yahoo Finance JSON ────────────────────────────────────────────────────────
// 株価取得と同じ query1.finance.yahoo.com から JSON で取れる。RSS より安定。

async function fetchYahooNews(query: string): Promise<Headline[]> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v1/finance/search` +
      `?q=${query}&newsCount=8&enableFuzzyQuery=false&lang=en-US&region=US`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const items: Array<{
      title?: string;
      publisher?: string;
      providerPublishTime?: number;
      link?: string;
    }> = json?.news ?? [];
    return items
      .map((item) => ({
        title:       item.title ?? "",
        description: "",
        source:      item.publisher ?? "Yahoo Finance",
        pubDate:     item.providerPublishTime
                       ? new Date(item.providerPublishTime * 1000).toUTCString()
                       : "",
      }))
      .filter((h) => h.title.length > 0);
  } catch {
    return [];
  }
}

// ── RSS フォールバック ─────────────────────────────────────────────────────────
// Yahoo が詰まった場合のみ使う

function extractTag(xml: string, tag: string): string {
  const m = xml.match(
    new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`
    )
  );
  return (m?.[1] ?? m?.[2] ?? "")
    .trim()
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .slice(0, 200);
}

function parseItems(xml: string, source: string): Headline[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return items
    .slice(0, 5)
    .map((item) => ({
      title:       extractTag(item, "title"),
      description: extractTag(item, "description"),
      source,
      pubDate:     extractTag(item, "pubDate"),
    }))
    .filter((h) => h.title.length > 0);
}

async function fetchRSS(url: string, source: string): Promise<Headline[]> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/rss+xml,application/xml,text/xml",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return parseItems(await res.text(), source);
  } catch {
    return [];
  }
}

const RSS_FALLBACKS = [
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    source: "CNBC",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
];

// ── 公開エントリーポイント ────────────────────────────────────────────────────

export async function fetchHeadlines(): Promise<Headline[]> {
  // SPY/QQQ+マクロ + Mag7個別株の3クエリ並列
  const [yf1, yf2, yf3] = await Promise.all([
    fetchYahooNews("SPY+QQQ+stock+market"),
    fetchYahooNews("economy+interest+rate+inflation"),
    fetchYahooNews("NVDA+AAPL+MSFT+TSLA+META+AMZN+GOOGL+earnings"),
  ]);

  const combined = dedup([...yf1, ...yf2, ...yf3]);
  if (combined.length >= 5) return combined.slice(0, 14);

  // フォールバック
  const rssResults = await Promise.all(
    RSS_FALLBACKS.map((s) => fetchRSS(s.url, s.source))
  );
  return dedup([...combined, ...rssResults.flat()]).slice(0, 14);
}

// 個別ページ用: 銘柄コード or 社名でニュースを取得（Claude分析なし・生ヘッドライン）
export async function fetchTickerNews(
  ticker: string,
  companyName?: string,
): Promise<Headline[]> {
  // JP株は "7203 Toyota stock" 形式、US株は "NVDA stock earnings"
  const query = companyName
    ? encodeURIComponent(`${companyName.slice(0, 15)} stock`)
    : encodeURIComponent(`${ticker} stock earnings`);
  return fetchYahooNews(query);
}

function dedup(headlines: Headline[]): Headline[] {
  const seen = new Set<string>();
  return headlines.filter((h) => {
    const key = h.title.slice(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
