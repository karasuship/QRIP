export interface NttNewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: string;
}

async function fetchNewsForTicker(ticker: string): Promise<NttNewsItem[]> {
  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${ticker}&quotesCount=0&newsCount=4&enableFuzzyQuery=false`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
      next: { revalidate: 1800 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const news = json?.news ?? [];
    if (!Array.isArray(news)) return [];
    return news
      .filter((n: Record<string, unknown>) => n.title && n.link)
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

// 後方互換
export async function fetchNttNews(): Promise<NttNewsItem[]> {
  return fetchNewsForTicker("9432.T");
}

// NTT + JT + KDDI のニュースを統合（タイトル重複を除去、日付降順）
export async function fetchJpStockNews(): Promise<NttNewsItem[]> {
  const [ntt, jt, kddi] = await Promise.allSettled([
    fetchNewsForTicker("9432.T"),
    fetchNewsForTicker("2914.T"),
    fetchNewsForTicker("9433.T"),
  ]);

  const all = [
    ...(ntt.status === "fulfilled" ? ntt.value : []),
    ...(jt.status  === "fulfilled" ? jt.value  : []),
    ...(kddi.status === "fulfilled" ? kddi.value : []),
  ];

  // タイトル重複除去 → 日付降順 → 最大8件
  const seen = new Set<string>();
  return all
    .filter((n) => { if (seen.has(n.title)) return false; seen.add(n.title); return true; })
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, 8);
}
