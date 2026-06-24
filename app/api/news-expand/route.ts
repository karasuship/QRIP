import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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

function isAllowedOrigin(req: NextRequest): boolean {
  const origin  = req.headers.get("origin")  ?? "";
  const referer = req.headers.get("referer") ?? "";
  return ALLOWED_ORIGINS.some(
    (o) => origin.startsWith(o) || referer.startsWith(o)
  );
}

export async function POST(req: NextRequest): Promise<NextResponse<ExpandResult | { error: string }>> {
  if (!isAllowedOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await req.json();
    // 入力長を制限してプロンプトインジェクションの影響を抑える
    const title       = String(body.title       ?? "").slice(0, 200);
    const description = String(body.description ?? "").slice(0, 300);
    const source      = String(body.source      ?? "").slice(0, 80);

    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

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
      return NextResponse.json({ deep_analysis: text, sp500_direction: "neutral", key_numbers: [], watch_next: "" });
    }
    const parsed = JSON.parse(match[0]);
    const VALID = new Set(["bullish", "bearish", "neutral"]);
    return NextResponse.json({
      deep_analysis: String(parsed.deep_analysis ?? "").slice(0, 400),
      sp500_direction: VALID.has(parsed.sp500_direction) ? parsed.sp500_direction : "neutral",
      key_numbers: Array.isArray(parsed.key_numbers) ? parsed.key_numbers.slice(0, 3).map(String) : [],
      watch_next: String(parsed.watch_next ?? "").slice(0, 100),
    });
  } catch {
    return NextResponse.json({ error: "analysis failed" }, { status: 500 });
  }
}
