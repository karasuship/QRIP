export interface NttNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string; // ISO date string
}

export async function fetchNttNews(): Promise<NttNewsItem[]> {
  const url =
    "https://query1.finance.yahoo.com/v1/finance/search" +
    "?q=9432.T&quotesCount=0&newsCount=8&enableFuzzyQuery=false";
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
      },
      next: { revalidate: 1800 }, // 30分キャッシュ
    });
    if (!res.ok) return [];
    const json = await res.json();
    const news = json?.news ?? [];
    if (!Array.isArray(news)) return [];

    return news
      .filter((n: Record<string, unknown>) => n.title && n.link)
      .slice(0, 6)
      .map((n: Record<string, unknown>) => ({
        title: String(n.title ?? ""),
        link: String(n.link ?? ""),
        publisher: String(n.publisher ?? ""),
        publishedAt: n.providerPublishTime
          ? new Date(Number(n.providerPublishTime) * 1000).toISOString()
          : "",
      }));
  } catch {
    return [];
  }
}
