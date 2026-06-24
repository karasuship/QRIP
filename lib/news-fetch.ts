/**
 * 金融ニュース RSS 取得モジュール
 * Reuters / CNBC / MarketWatch の RSS から今日のヘッドラインを収集する
 */

export interface Headline {
  title: string;
  description: string;
  source: string;
  pubDate: string;
}

const RSS_SOURCES = [
  {
    url: "https://news.google.com/rss/search?q=stock+market+S%26P500&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
  },
  {
    url: "https://news.google.com/rss/search?q=Federal+Reserve+interest+rate&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
  },
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    source: "CNBC",
  },
  {
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    source: "MarketWatch",
  },
];

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return (m?.[1] ?? m?.[2] ?? "").trim().replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").slice(0, 200);
}

function parseItems(xml: string, source: string): Headline[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/g) ?? [];
  return items.slice(0, 5).map((item) => ({
    title: extractTag(item, "title"),
    description: extractTag(item, "description"),
    source,
    pubDate: extractTag(item, "pubDate"),
  })).filter((h) => h.title.length > 0);
}

async function fetchRSS(url: string, source: string): Promise<Headline[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/rss+xml,application/xml,text/xml" },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseItems(xml, source);
  } catch {
    return [];
  }
}

export async function fetchHeadlines(): Promise<Headline[]> {
  const results = await Promise.all(
    RSS_SOURCES.map((s) => fetchRSS(s.url, s.source))
  );
  // 全ソースをまとめて最大10本
  return results.flat().slice(0, 10);
}
