/**
 * SNS センチメント取得モジュール
 * - StockTwits: $SPY の強気/弱気比率・投稿数
 * - Reddit WSB: SP500/SPY 関連の言及数・加熱度
 */

export interface SocialData {
  // StockTwits
  st_spy_bullish_pct: number | null;  // 強気投稿の割合
  st_spy_bearish_pct: number | null;  // 弱気投稿の割合
  st_spy_msg_count: number | null;    // 直近メッセージ数（加熱度の代理）
  // Reddit WSB
  reddit_wsb_mentions: number | null; // 24時間内の言及数
  reddit_wsb_heat: number | null;     // 言及投稿の平均スコア（upvotes）
}

// ──────────────────────────────────────────────
// StockTwits（無料・認証不要）
// ──────────────────────────────────────────────
async function fetchStockTwits(): Promise<Partial<SocialData>> {
  try {
    const res = await fetch(
      "https://api.stocktwits.com/api/2/streams/symbol/SPY.json",
      {
        headers: { "User-Agent": "Mozilla/5.0" },
        cache: "no-store",
      }
    );
    if (!res.ok) return {};
    const json = await res.json();
    const messages: { entities?: { sentiment?: { basic?: string } } }[] =
      json.messages ?? [];

    let bullish = 0, bearish = 0, total = 0;
    for (const m of messages) {
      const s = m.entities?.sentiment?.basic;
      if (s === "Bullish") bullish++;
      else if (s === "Bearish") bearish++;
      total++;
    }
    const tagged = bullish + bearish;
    return {
      st_spy_bullish_pct: tagged > 0 ? bullish / tagged : null,
      st_spy_bearish_pct: tagged > 0 ? bearish / tagged : null,
      st_spy_msg_count: total,
    };
  } catch {
    return {};
  }
}

// ──────────────────────────────────────────────
// Reddit r/wallstreetbets（無料・認証不要）
// ──────────────────────────────────────────────
async function fetchRedditWSB(): Promise<Partial<SocialData>> {
  try {
    // 過去24時間の SPY/SP500/market 言及を検索
    const query = encodeURIComponent("SPY OR \"S&P\" OR \"market crash\" OR \"buy the dip\"");
    const url = `https://www.reddit.com/r/wallstreetbets/search.json?q=${query}&sort=new&limit=25&t=day&restrict_sr=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "QRIP-bot/1.0 (financial research)",
        "Accept": "application/json",
      },
      cache: "no-store",
    });
    if (!res.ok) return {};
    const json = await res.json();
    const posts: { score: number; num_comments: number }[] =
      (json.data?.children ?? []).map((c: { data: { score: number; num_comments: number } }) => c.data);

    if (posts.length === 0) return { reddit_wsb_mentions: 0, reddit_wsb_heat: null };

    const avgScore = posts.reduce((a, p) => a + p.score, 0) / posts.length;
    return {
      reddit_wsb_mentions: posts.length,
      reddit_wsb_heat: Math.round(avgScore),
    };
  } catch {
    return {};
  }
}

// ──────────────────────────────────────────────
// 公開関数
// ──────────────────────────────────────────────
export async function fetchSocialData(): Promise<SocialData> {
  const [st, reddit] = await Promise.all([fetchStockTwits(), fetchRedditWSB()]);
  return {
    st_spy_bullish_pct: st.st_spy_bullish_pct ?? null,
    st_spy_bearish_pct: st.st_spy_bearish_pct ?? null,
    st_spy_msg_count: st.st_spy_msg_count ?? null,
    reddit_wsb_mentions: reddit.reddit_wsb_mentions ?? null,
    reddit_wsb_heat: reddit.reddit_wsb_heat ?? null,
  };
}
