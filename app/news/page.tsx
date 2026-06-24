import type { Metadata } from "next";
import Link from "next/link";
import { fetchHeadlines } from "@/lib/news-fetch";
import { analyzeNews } from "@/lib/news-analyze";

export const metadata: Metadata = {
  title: "QRIP — 今日のニュース",
  description: "金融ニュースの要約・センチメント・Fed トーンをリアルタイム表示（30分更新）",
};

export const revalidate = 1800;

const TOPIC_LABELS: Record<string, { label: string; color: string }> = {
  inflation:   { label: "インフレ",   color: "border-orange-400/40 bg-orange-400/[0.08] text-orange-300" },
  recession:   { label: "景気後退",   color: "border-red-400/40 bg-red-400/[0.08] text-red-300" },
  fed:         { label: "Fed",         color: "border-violet-400/40 bg-violet-400/[0.08] text-violet-300" },
  geopolitics: { label: "地政学",     color: "border-amber-400/40 bg-amber-400/[0.08] text-amber-300" },
  earnings:    { label: "決算",        color: "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]" },
  tech:        { label: "テック",      color: "border-sky-400/40 bg-sky-400/[0.08] text-sky-300" },
  energy:      { label: "エネルギー", color: "border-yellow-400/40 bg-yellow-400/[0.08] text-yellow-300" },
  credit:      { label: "信用",        color: "border-pink-400/40 bg-pink-400/[0.08] text-pink-300" },
  other:       { label: "その他",      color: "border-slate-400/40 bg-slate-400/[0.08] text-slate-300" },
};

const SOURCE_COLOR: Record<string, string> = {
  Reuters:     "bg-[#38bdf8]/15 text-[#38bdf8]",
  CNBC:        "bg-[#34d399]/15 text-[#34d399]",
  MarketWatch: "bg-violet-400/15 text-violet-300",
};

function sentimentMeta(score: number) {
  if (score >= 0.5)  return { label: "強気",      color: "text-[#34d399]",  glow: "glow-green",  bar: "from-[#34d399]" };
  if (score >= 0.2)  return { label: "やや強気",  color: "text-[#34d399]",  glow: "glow-green",  bar: "from-[#34d399]" };
  if (score <= -0.5) return { label: "弱気",      color: "text-[#f87171]",  glow: "glow-red",    bar: "from-[#f87171]" };
  if (score <= -0.2) return { label: "やや弱気",  color: "text-[#f87171]",  glow: "glow-red",    bar: "from-[#f87171]" };
  return { label: "中立", color: "text-slate-300", glow: "", bar: "from-slate-400" };
}

const FED_CONFIG: Record<string, { label: string; color: string }> = {
  hawkish: { label: "タカ派（利上げ示唆）", color: "border-red-400/40 bg-red-400/[0.08] text-red-300" },
  dovish:  { label: "ハト派（利下げ示唆）", color: "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]" },
  neutral: { label: "中立",                  color: "border-white/[0.12] bg-white/[0.06] text-slate-400" },
  none:    { label: "Fed 言及なし",           color: "border-white/[0.09] bg-white/[0.04] text-slate-500" },
};

export default async function NewsPage() {
  const fetchedAt = new Date();
  let analysis = null;
  try {
    const headlines = await fetchHeadlines();
    analysis = await analyzeNews(headlines);
  } catch { /* silent */ }

  const score = analysis?.sentiment_score ?? 0;
  const meta = sentimentMeta(score);
  const barPct = Math.round((score + 1) * 50);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">News / 今日のニュース</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">市場ニュース</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            {fetchedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })} 取得 · 30分キャッシュ · Reuters / CNBC / MarketWatch
          </p>
        </div>

        {!analysis ? (
          <div className="mt-8 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-8 text-center text-slate-400 backdrop-blur-md">
            ニュース取得に失敗しました。しばらくしてから再読み込みしてください。
          </div>
        ) : (
          <div className="mt-6 space-y-4">

            {/* センチメント大表示 */}
            <div className={`rounded-2xl border border-white/[0.12] bg-white/[0.06] p-6 backdrop-blur-md ${meta.glow}`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-4">市場センチメント</p>
              <div className="flex items-end gap-4">
                <span className={`font-mono text-6xl font-bold tabular-nums leading-none ${meta.color}`}>
                  {score >= 0 ? "+" : ""}{score.toFixed(2)}
                </span>
                <span className={`mb-1 text-xl font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
              {/* グラデーションバー */}
              <div className="mt-5 relative h-1.5 w-full rounded-full bg-gradient-to-r from-[#f87171] via-slate-500/40 to-[#34d399]">
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                  style={{ left: `${barPct}%` }}
                />
              </div>
              <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-600">
                <span>弱気 −1</span><span>中立 0</span><span>強気 +1</span>
              </div>
            </div>

            {/* 危機関連度 / Fed / トピック */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {/* 危機関連度 */}
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">危機関連度</p>
                <div className="flex items-center gap-2">
                  {[1,2,3,4,5].map((i) => (
                    <span
                      key={i}
                      className={`h-3 w-3 rounded-full transition-all ${
                        i <= analysis.crisis_relevance
                          ? i >= 4 ? "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.6)]"
                          : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                          : "bg-white/[0.10]"
                      }`}
                    />
                  ))}
                  <span className={`ml-1 font-mono text-sm font-bold ${
                    analysis.crisis_relevance >= 4 ? "text-[#f87171]"
                    : analysis.crisis_relevance >= 2 ? "text-amber-400"
                    : "text-slate-500"
                  }`}>{analysis.crisis_relevance}/5</span>
                </div>
              </div>

              {/* Fed トーン */}
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">Fed トーン</p>
                {(() => {
                  const fed = FED_CONFIG[analysis.fed_tone] ?? FED_CONFIG.none;
                  return (
                    <span className={`inline-flex items-center rounded-xl border px-3 py-1 text-xs font-medium ${fed.color}`}>
                      {fed.label}
                    </span>
                  );
                })()}
              </div>

              {/* 主要トピック */}
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">主要トピック</p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.main_topics.length > 0
                    ? analysis.main_topics.map((t) => {
                        const cfg = TOPIC_LABELS[t] ?? TOPIC_LABELS.other;
                        return (
                          <span key={t} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                            {cfg.label}
                          </span>
                        );
                      })
                    : <span className="text-xs text-slate-500">—</span>
                  }
                </div>
              </div>
            </div>

            {/* 特記事項 */}
            {analysis.notable_events && (
              <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-5 py-3.5 backdrop-blur-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8]/60 mb-1">特記事項</p>
                <p className="text-sm leading-6 text-slate-300">{analysis.notable_events}</p>
              </div>
            )}

            {/* ヘッドライン */}
            {analysis.headlines_ja.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">ヘッドライン</p>
                <div className="space-y-2">
                  {analysis.headlines_ja.map((h, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-white/[0.12] bg-white/[0.06] px-5 py-4 backdrop-blur-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium leading-snug text-[#e8f4ff]">{h.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-[10px] font-medium ${SOURCE_COLOR[h.source] ?? "bg-white/[0.06] text-slate-400"}`}>
                          {h.source}
                        </span>
                      </div>
                      {h.description && (
                        <p className="mt-1.5 text-xs leading-5 text-slate-400">{h.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        <p className="mt-8 font-mono text-[10px] leading-5 text-slate-600">
          ニュース: Reuters · CNBC · MarketWatch RSS。翻訳・分析: Claude Haiku。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
