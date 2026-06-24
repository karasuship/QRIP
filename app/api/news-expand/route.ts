import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { newsExpandLimiter, getClientIP, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";

export interface ExpandResult {
  deep_analysis: string;
  sp500_direction: "bullish" | "bearish" | "neutral";
  key_numbers: string[];
  watch_next: string;
}

const ALLOWED_ORIGINS = [
  "https://qrip-eight.vercel.app",
  "http://localhost:3000",
];

function getAllowedOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin") ?? "";
  return ALLOWED_ORIGINS.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin":  origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

// CORS preflight
export async function OPTIONS(req: NextRequest) {
  const origin = getAllowedOrigin(req);
  if (!origin) return new NextResponse(null, { status: 403 });
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: NextRequest): Promise<NextResponse<ExpandResult | { error: string }>> {
  // ── CORS ──
  const origin = getAllowedOrigin(req);
  if (!origin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const headers = corsHeaders(origin);

  // ── レートリミット（Upstash Redis が設定済みの場合のみ） ──
  if (newsExpandLimiter) {
    const ip = getClientIP(req);
    const { success, remaining, reset } = await newsExpandLimiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a few minutes." },
        { status: 429, headers: { ...headers, ...rateLimitHeaders(remaining, reset) } }
      );
    }
  }

  try {
    const body = await req.json();
    // 入力長を制限してプロンプトインジェクションの影響範囲を抑える
    const title       = String(body.title       ?? "").slice(0, 200);
    const description = String(body.description ?? "").slice(0, 300);
    const source      = String(body.source      ?? "").slice(0, 80);

    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400, headers });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "service unavailable" }, { status: 503, headers });
    }

    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      messages: [{
        role: "user",
        content: `以下の金融ニュースを、日本の個人SP500投資家向けに深掘り解説してください。

ニュース: [${source}] ${title}${description ? "\n要約: " + description : ""}

以下のJSONのみで返答（前後の説明文は不要）:
{
  "deep_analysis": "このニュースの背景・なぜ起きたか・SP500長期投資家への意味（200字以内）",
  "sp500_direction": "bullish または bearish または neutral",
  "key_numbers": ["関連する数値・指標を最大3つ（例: 'Fed利上げ+0.25%', 'PCE前年比2.4%'）"],
  "watch_next": "次に注目すべき指標・イベント（1文）"
}`,
      }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text : "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json(
        { deep_analysis: text, sp500_direction: "neutral", key_numbers: [], watch_next: "" },
        { headers }
      );
    }
    const parsed = JSON.parse(match[0]);
    const VALID = new Set(["bullish", "bearish", "neutral"]);
    return NextResponse.json(
      {
        deep_analysis:   String(parsed.deep_analysis   ?? "").slice(0, 400),
        sp500_direction: VALID.has(parsed.sp500_direction) ? parsed.sp500_direction : "neutral",
        key_numbers:     Array.isArray(parsed.key_numbers)
                           ? parsed.key_numbers.slice(0, 3).map(String)
                           : [],
        watch_next:      String(parsed.watch_next ?? "").slice(0, 100),
      },
      { headers }
    );
  } catch {
    return NextResponse.json({ error: "analysis failed" }, { status: 500, headers });
  }
}
