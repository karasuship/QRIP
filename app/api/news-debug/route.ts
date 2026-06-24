import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probe(label: string, url: string, opts?: RequestInit) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0", ...(opts?.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text().catch(() => "");
    const ms = Date.now() - start;
    // JSONなら news 配列の長さ、XMLなら <item> の数を数える
    let count = 0;
    try { count = (JSON.parse(text)?.news ?? []).length; } catch {
      count = (text.match(/<item/g) ?? []).length;
    }
    return { label, status: res.status, ms, count, preview: text.slice(0, 120) };
  } catch (e) {
    return { label, status: 0, ms: Date.now() - start, count: 0, error: String(e) };
  }
}

export async function GET() {
  const results = await Promise.all([
    probe(
      "YF-JSON-SPY",
      "https://query1.finance.yahoo.com/v1/finance/search?q=SPY+stock+market&newsCount=5&enableFuzzyQuery=false",
    ),
    probe(
      "YF-JSON-FED",
      "https://query1.finance.yahoo.com/v1/finance/search?q=economy+interest+rate&newsCount=5&enableFuzzyQuery=false",
    ),
    probe(
      "CNBC-RSS",
      "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    ),
    probe(
      "MW-RSS",
      "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    ),
    probe(
      "GoogleNews-SP500",
      "https://news.google.com/rss/search?q=S%26P500+stock+market&hl=en-US&gl=US&ceid=US:en",
    ),
    probe(
      "YF-v8-chart (SP500 baseline)",
      "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d",
    ),
  ]);

  // Anthropic APIキーの存在確認（値は返さない）
  const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;

  return NextResponse.json({ results, hasAnthropicKey, ts: new Date().toISOString() });
}
