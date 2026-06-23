import { NextResponse } from "next/server";
import { fetchHeadlines } from "@/lib/news-fetch";
import { analyzeNews } from "@/lib/news-analyze";
import type { Headline } from "@/lib/news-fetch";
import type { NewsAnalysis } from "@/lib/news-analyze";

export const runtime = "nodejs";
export const revalidate = 1800; // 30分キャッシュ

export interface NewsResponse {
  fetchedAt: string;
  headlines: Headline[];
  analysis: NewsAnalysis | null;
}

export async function GET(): Promise<NextResponse<NewsResponse | { error: string }>> {
  try {
    const headlines = await fetchHeadlines();
    const analysis = await analyzeNews(headlines);
    return NextResponse.json({
      fetchedAt: new Date().toISOString(),
      headlines,
      analysis,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "取得失敗" },
      { status: 500 }
    );
  }
}
