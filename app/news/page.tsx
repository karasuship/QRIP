import type { Metadata } from "next";
import Link from "next/link";
import { fetchHeadlines } from "@/lib/news-fetch";
import { analyzeNews } from "@/lib/news-analyze";
import type { Headline } from "@/lib/news-fetch";
import type { NewsAnalysis } from "@/lib/news-analyze";

export const metadata: Metadata = {
  title: "QRIP — 今日のニュース",
  description: "金融ニュースの要約・センチメント・Fed トーンをリアルタイム表示（30分更新）",
};

export const revalidate = 1800;

function SentimentBar({ score }: { score: number }) {
  const pct = Math.round((score + 1) * 50); // -1〜+1 → 0〜100%
  const color =
    score >= 0.3 ? "bg-emerald-500" :
    score <= -0.3 ? "bg-red-500" :
    "bg-zinc-400";
  const label =
    score >= 0.5 ? "強気" :
    score >= 0.2 ? "やや強気" :
    score <= -0.5 ? "弱気" :
    score <= -0.2 ? "やや弱気" :
    "中立";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-zinc-500">
        <span>弱気 −1</span>
        <span className="font-semibold text-zinc-700 dark:text-zinc-300">
          {score >= 0 ? "+" : ""}{score.toFixed(2)} {label}
        </span>
        <span>強気 +1</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-700">
        <div
          className={`absolute top-0 h-2 w-1 rounded-full ${color}`}
          style={{ left: `calc(${pct}% - 2px)` }}
        />
        <div className="absolute top-0 left-1/2 h-2 w-px bg-zinc-400" />
      </div>
    </div>
  );
}

function CrisisDots({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`inline-block h-3 w-3 rounded-full ${
            i <= score ? "bg-red-500" : "bg-zinc-200 dark:bg-zinc-700"
          }`}
        />
      ))}
      <span className="ml-1 text-sm text-zinc-500">{score} / 5</span>
    </div>
  );
}

function FedBadge({ tone }: { tone: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    hawkish: { label: "タカ派（利上げ示唆）", cls: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300" },
    dovish:  { label: "ハト派（利下げ示唆）", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
    neutral: { label: "中立", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" },
    none:    { label: "Fed 言及なし", cls: "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500" },
  };
  const c = config[tone] ?? config.none;
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${c.cls}`}>
      Fed: {c.label}
    </span>
  );
}

const TOPIC_LABELS: Record<string, string> = {
  inflation: "インフレ", recession: "景気後退", fed: "Fed",
  geopolitics: "地政学", earnings: "決算", tech: "テック",
  energy: "エネルギー", credit: "信用", other: "その他",
};

export default async function NewsPage() {
  const fetchedAt = new Date();
  let headlines: Headline[] = [];
  let analysis: NewsAnalysis | null = null;
  try {
    headlines = await fetchHeadlines();
    analysis = await analyzeNews(headlines);
  } catch {
    // 取得失敗時は null のまま
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
        ← ホームに戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">今日のニュース</h1>
        <p className="mt-1 text-sm text-zinc-500">
          {fetchedAt
            ? `取得: ${fetchedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} · 30分キャッシュ`
            : "Reuters · CNBC · MarketWatch（30分更新）"}
        </p>
      </div>

      {!analysis ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 text-center text-zinc-500">
          ニュース取得に失敗しました。しばらくしてから再読み込みしてください。
        </div>
      ) : (
        <>
          {/* センチメント */}
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">市場センチメント</h2>
            <SentimentBar score={analysis.sentiment_score} />

            <div className="flex flex-wrap gap-3 pt-1">
              <div>
                <p className="text-xs text-zinc-500 mb-1">危機関連度</p>
                <CrisisDots score={analysis.crisis_relevance} />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Fed トーン</p>
                <FedBadge tone={analysis.fed_tone} />
              </div>
            </div>

            {analysis.main_topics.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {analysis.main_topics.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    {TOPIC_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            )}

            {analysis.notable_events && (
              <p className="text-sm text-zinc-700 dark:text-zinc-300 border-l-2 border-zinc-300 dark:border-zinc-600 pl-3">
                {analysis.notable_events}
              </p>
            )}
          </div>

          {/* ヘッドライン */}
          {headlines.length > 0 && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="px-5 py-3">
                <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">ヘッドライン</h2>
              </div>
              {headlines.map((h, i) => (
                <div key={i} className="px-5 py-3 space-y-0.5">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-snug">{h.title}</p>
                  {h.description && (
                    <p className="text-xs text-zinc-500 leading-relaxed">{h.description}</p>
                  )}
                  <p className="text-xs text-zinc-400">{h.source}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <p className="text-xs text-zinc-400 text-center">
        ニュース: Reuters · CNBC · MarketWatch RSS。分析: Claude Haiku。これは投資助言ではありません。
      </p>
    </div>
  );
}
