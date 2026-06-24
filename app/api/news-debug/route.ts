import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function probe(label: string, url: string) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await res.text().catch(() => "");
    const ms = Date.now() - start;
    let count = 0;
    try { count = (JSON.parse(text)?.news ?? []).length; } catch {
      count = (text.match(/<item/g) ?? []).length;
    }
    return { label, ok: res.status === 200, status: res.status, ms, count, preview: text.slice(0, 100) };
  } catch (e) {
    return { label, ok: false, status: 0, ms: Date.now() - start, count: 0, error: String(e).slice(0, 100) };
  }
}

async function probeAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false, error: "ANTHROPIC_API_KEY 未設定" };
  const start = Date.now();
  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: "say ok" }],
    });
    return { ok: true, ms: Date.now() - start, model: msg.model, usage: msg.usage };
  } catch (e) {
    return { ok: false, ms: Date.now() - start, error: String(e).slice(0, 200) };
  }
}

export async function GET() {
  const [fetchResults, anthropic] = await Promise.all([
    Promise.all([
      probe("YF-JSON-SPY",    "https://query1.finance.yahoo.com/v1/finance/search?q=SPY+stock+market&newsCount=5&enableFuzzyQuery=false"),
      probe("YF-JSON-FED",    "https://query1.finance.yahoo.com/v1/finance/search?q=economy+interest+rate&newsCount=5&enableFuzzyQuery=false"),
      probe("YF-v8-chart",    "https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=1d&interval=1d"),
      probe("CNBC-RSS",       "https://www.cnbc.com/id/100003114/device/rss/rss.html"),
      probe("MW-RSS",         "https://feeds.content.dowjones.io/public/rss/mw_topstories"),
      probe("GoogleNews",     "https://news.google.com/rss/search?q=S%26P500+stock+market&hl=en-US&gl=US&ceid=US:en"),
    ]),
    probeAnthropic(),
  ]);

  return NextResponse.json({
    ts: new Date().toISOString(),
    fetchResults,
    anthropic,
  });
}
