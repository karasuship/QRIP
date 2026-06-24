import type { Metadata } from "next";
import { createHash } from "crypto";
import Link from "next/link";
import { fetchMmf } from "@/lib/mmf-fetch";
import { getSupabaseServer } from "@/lib/supabase";
import type { NewsAnalysis } from "@/lib/news-analyze";
import NewsSection from "./NewsSection";

export const metadata: Metadata = {
  title: "QRIP — 今日のニュース",
  description: "金融ニュースの要約・センチメント・Fed トーンをリアルタイム表示",
};

// 毎日 cron が news_daily を更新するので、ページは DB から読むだけ
// キャッシュは 1 時間。cron は 7:00 JST に走るので最大 25 時間遅れ（週末含む）
export const revalidate = 3600;

function newsId(title: string): string {
  return createHash("sha256").update(title).digest("hex").slice(0, 32);
}

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

function sentimentMeta(score: number) {
  if (score >= 0.5)  return { label: "強気",      color: "text-[#34d399]",  glow: "glow-green" };
  if (score >= 0.2)  return { label: "やや強気",  color: "text-[#34d399]",  glow: "glow-green" };
  if (score <= -0.5) return { label: "弱気",      color: "text-[#f87171]",  glow: "glow-red"   };
  if (score <= -0.2) return { label: "やや弱気",  color: "text-[#f87171]",  glow: "glow-red"   };
  return { label: "中立", color: "text-slate-300", glow: "" };
}

const FED_CONFIG: Record<string, { label: string; color: string }> = {
  hawkish: { label: "タカ派（利上げ示唆）", color: "border-red-400/40 bg-red-400/[0.08] text-red-300" },
  dovish:  { label: "ハト派（利下げ示唆）", color: "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]" },
  neutral: { label: "中立",                  color: "border-white/[0.12] bg-white/[0.06] text-slate-400" },
  none:    { label: "Fed 言及なし",           color: "border-white/[0.09] bg-white/[0.04] text-slate-500" },
};

export default async function NewsPage() {
  // ── Supabase から最新キャッシュを読む（cron が毎朝 7:00 JST に書き込む）──
  let analysis: NewsAnalysis | null = null;
  let dataDate: string | null = null;

  try {
    const supabase = getSupabaseServer();
    const { data: cached } = await supabase
      .from("news_daily")
      .select("date, raw_claude_output")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (cached?.raw_claude_output) {
      analysis = cached.raw_claude_output as NewsAnalysis;
      dataDate = cached.date as string;
    }
  } catch { /* DB が空なら null のまま */ }

  // MMF だけは独立して取得（軽い・失敗しても無視）
  const mmf = await fetchMmf().catch(() => null);

  // social 機能用いいね数取得
  let likeCounts: Record<string, number> = {};
  if (analysis?.headlines_ja.length) {
    const ids = analysis.headlines_ja.map((h) => newsId(h.title));
    try {
      const supabase = getSupabaseServer();
      // news_items が存在しない場合も無視
      await supabase.from("news_items").upsert(
        analysis.headlines_ja.map((h, i) => ({
          id: ids[i],
          title_ja: h.title,
          source: h.source,
        })),
        { onConflict: "id", ignoreDuplicates: true }
      );
      const { data: reactions } = await supabase
        .from("news_reactions")
        .select("news_item_id")
        .in("news_item_id", ids);
      for (const r of reactions ?? []) {
        const id = r.news_item_id as string;
        likeCounts[id] = (likeCounts[id] ?? 0) + 1;
      }
    } catch { /* social features are optional */ }
  }

  const score = analysis?.sentiment_score ?? 0;
  const meta = sentimentMeta(score);
  const barPct = Math.round((score + 1) * 50);

  const newsItems = (analysis?.headlines_ja ?? []).map((h) => {
    const id = newsId(h.title);
    return { ...h, newsId: id, initialLikeCount: likeCounts[id] ?? 0 };
  });

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
            {dataDate ? `${dataDate} のデータ · 毎営業日 7:00 JST 更新` : "データ準備中"}
          </p>
        </div>

        {!analysis ? (
          <div className="mt-8 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-8 backdrop-blur-md space-y-2 text-center">
            <p className="text-slate-400">データがまだありません</p>
            <p className="font-mono text-[10px] text-slate-600">
              毎営業日 7:00 JST に自動更新されます。初回データは翌朝以降に表示されます。
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">

            {/* センチメント */}
            <div className={`rounded-2xl border border-white/[0.12] bg-white/[0.06] p-6 backdrop-blur-md ${meta.glow}`}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-4">市場センチメント</p>
              <div className="flex items-end gap-4">
                <span className={`font-mono text-6xl font-bold tabular-nums leading-none ${meta.color}`}>
                  {score >= 0 ? "+" : ""}{score.toFixed(2)}
                </span>
                <span className={`mb-1 text-xl font-semibold ${meta.color}`}>{meta.label}</span>
              </div>
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

            {/* MMF 燃料スコア */}
            {mmf && (
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  MMF 燃料スコア — SP500 上昇余地
                </p>
                <div className="flex items-end gap-3 mb-4">
                  <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${
                    mmf.fuel_score >= 7 ? "text-[#34d399]" : mmf.fuel_score >= 4 ? "text-amber-400" : "text-slate-400"
                  }`}>{mmf.fuel_score}<span className="text-lg text-slate-500">/10</span></span>
                  <span className="mb-1 text-sm text-slate-400">
                    MMF残高 <span className="font-mono font-semibold text-slate-300">${mmf.current_billions.toLocaleString()}B</span>
                    <span className="ml-2 text-slate-600 text-xs">（52週 min ${mmf.min_52w.toLocaleString()}B → max ${mmf.max_52w.toLocaleString()}B）</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      mmf.fuel_score >= 7 ? "bg-[#34d399]" : mmf.fuel_score >= 4 ? "bg-amber-400" : "bg-slate-500"
                    }`}
                    style={{ width: `${mmf.fuel_score * 10}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  MMF残高が52週レンジの高位 = 現金待機が多い = 株への流入余地が大きい。（データ: FRED WRMFSL、{mmf.last_date}時点）
                </p>
              </div>
            )}

            {/* 危機関連度 / Fed / トピック */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">危機関連度</p>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`h-3 w-3 rounded-full ${
                      i <= analysis.crisis_relevance
                        ? i >= 4 ? "bg-[#f87171] shadow-[0_0_8px_rgba(248,113,113,0.6)]"
                          : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
                        : "bg-white/[0.10]"
                    }`} />
                  ))}
                  <span className={`ml-1 font-mono text-sm font-bold ${
                    analysis.crisis_relevance >= 4 ? "text-[#f87171]"
                    : analysis.crisis_relevance >= 2 ? "text-amber-400"
                    : "text-slate-500"
                  }`}>{analysis.crisis_relevance}/5</span>
                </div>
              </div>

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
            {newsItems.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                  ヘッドライン — クリックで深掘り
                </p>
                <NewsSection items={newsItems} />
              </div>
            )}

          </div>
        )}

        <p className="mt-8 font-mono text-[10px] leading-5 text-slate-600">
          ニュース分析: Claude Haiku（毎営業日 7:00 JST 自動更新）。MMF: FRED WRMFSL。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
