import Anthropic from "@anthropic-ai/sdk";
import type { Headline } from "./news-fetch";

export interface HeadlineJa {
  title: string;
  description: string;
  source: string;
}

export interface NewsAnalysis {
  sentiment_score: number;
  crisis_relevance: number;
  fed_tone: string;
  main_topics: string[];
  notable_events: string;
  headlines_ja: HeadlineJa[];
  model_used: string;
}

export async function analyzeNews(headlines: Headline[]): Promise<NewsAnalysis | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || headlines.length === 0) return null;

  const client = new Anthropic({ apiKey });

  const headlineText = headlines
    .map((h, i) => `${i + 1}. [${h.source}] ${h.title}${h.description ? " — " + h.description : ""}`)
    .join("\n");

  const prompt = `あなたは金融市場アナリストです。以下の英語の金融ニュースヘッドラインを分析し、日本語に翻訳してください。

ヘッドライン:
${headlineText}

以下のJSON形式のみで回答してください（説明文は不要）:
{
  "sentiment_score": （-1.0〜1.0。-1=非常に悲観、0=中立、1=非常に楽観）,
  "crisis_relevance": （0〜5の整数。0=危機と無関係、5=直接的な金融危機）,
  "fed_tone": （"hawkish"=タカ派 | "dovish"=ハト派 | "neutral" | "none"=Fed言及なし）,
  "main_topics": （該当するものをリスト: "inflation" "recession" "fed" "geopolitics" "earnings" "tech" "energy" "credit" "other"）,
  "notable_events": （特記事項を日本語1文。特になければ空文字）,
  "headlines_ja": [
    { "title": "日本語タイトル（簡潔に）", "description": "日本語説明（元のdescriptionが空なら空文字）" },
    ...（入力と同じ順番・同じ本数）
  ]
}`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1500,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    const headlinesJa: HeadlineJa[] = Array.isArray(parsed.headlines_ja)
      ? parsed.headlines_ja.slice(0, headlines.length).map((h: { title?: string; description?: string }, i: number) => ({
          title: String(h.title || headlines[i]?.title || ""),
          description: String(h.description || ""),
          source: headlines[i]?.source || "",
        }))
      : headlines.map((h) => ({ title: h.title, description: h.description, source: h.source }));

    return {
      sentiment_score: Math.max(-1, Math.min(1, Number(parsed.sentiment_score) || 0)),
      crisis_relevance: Math.max(0, Math.min(5, Math.round(Number(parsed.crisis_relevance) || 0))),
      fed_tone: ["hawkish", "dovish", "neutral", "none"].includes(parsed.fed_tone) ? parsed.fed_tone : "none",
      main_topics: Array.isArray(parsed.main_topics) ? parsed.main_topics.slice(0, 6) : [],
      notable_events: String(parsed.notable_events || "").slice(0, 200),
      headlines_ja: headlinesJa,
      model_used: message.model,
    };
  } catch {
    return null;
  }
}
