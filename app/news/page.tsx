import type { Metadata } from "next";
import { createHash } from "crypto";
import Link from "next/link";
import { fetchHeadlines } from "@/lib/news-fetch";
import { analyzeNews } from "@/lib/news-analyze";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchPutCallRatio } from "@/lib/market-fetch";
import type { NewsAnalysis } from "@/lib/news-analyze";
import type { PutCallData } from "@/lib/market-fetch";
import NewsSection from "./NewsSection";

export const metadata: Metadata = {
  title: "QRIP — 今日のニュース",
  description: "金融ニュースの要約・センチメント・Put/Call比率・phi2との関係をリアルタイム表示",
};

export const revalidate = 3600;

function newsId(title: string): string {
  return createHash("sha256").update(title).digest("hex").slice(0, 32);
}

// ── 今日の空気（総合判定）────────────────────────────────────────────────────
// 憲法第三条「恐怖と過熱を分ける」を実装する。
// センチメント（Claude）× Put/Call（オプション市場の実態）× crs_impact（phi2との接続）
// の3軸で象限を決め、事実として言い切る。

function synthesize(
  score: number,
  pc: PutCallData | null,
  crsImpact: "positive" | "negative" | "neutral",
): { label: string; text: string; cls: string } {
  const fearByScore  = score <= -0.25;
  const fearByPC     = pc && (pc.level === "fear" || pc.level === "extreme_fear");
  const heatByScore  = score >= 0.30;
  const heatByPC     = pc && pc.level === "extreme_greed";

  if (fearByScore && fearByPC) return {
    label: "恐怖フェーズ",
    text:  "センチメントとオプション市場が両方、恐怖を示している。phi2発動条件の確認を。",
    cls:   "border-[#f87171]/40 bg-[#f87171]/[0.08] text-[#f87171]",
  };
  if (fearByScore || fearByPC) return {
    label: "弱気優位",
    text: crsImpact === "positive"
      ? "下落圧力あり、かつニュースがCRS成分を押し上げる材料を含む。"
      : "弱気環境だが、恐怖のピークには達していない。",
    cls:   "border-amber-400/40 bg-amber-400/[0.08] text-amber-400",
  };
  if (heatByScore && heatByPC) return {
    label: "楽観フェーズ",
    text:  "センチメントとオプション市場が両方、楽観を示している。追加投入より温存を。",
    cls:   "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]",
  };
  if (heatByScore || heatByPC) return {
    label: "やや楽観",
    text:  "強気寄りだが過熱感は限定的。通常のDCA継続。",
    cls:   "border-[#34d399]/30 bg-[#34d399]/[0.05] text-[#34d399]",
  };
  if (crsImpact === "positive") return {
    label: "材料混在",
    text:  "センチメントは中立だが、ニュースにCRSを高める要素が含まれる。注視を。",
    cls:   "border-amber-400/30 bg-amber-400/[0.06] text-amber-300",
  };
  return {
    label: "平常域",
    text:  "特段の変化なし。通常のDCA継続。ドライパウダーは温存。",
    cls:   "border-white/[0.12] bg-white/[0.06] text-slate-300",
  };
}

// ── センチメントスコアの言語化 ────────────────────────────────────────────────

function sentimentMeta(score: number) {
  if (score >= 0.5)  return { label: "強気",     color: "text-[#34d399]" };
  if (score >= 0.25) return { label: "やや強気", color: "text-[#34d399]" };
  if (score <= -0.5) return { label: "弱気",     color: "text-[#f87171]" };
  if (score <= -0.25)return { label: "やや弱気", color: "text-[#f87171]" };
  return { label: "中立", color: "text-slate-400" };
}

// ── Put/Call の表示設定 ───────────────────────────────────────────────────────
// 色の意味をCRSと統一: 恐怖 = チャンスに近い = violet/amber、楽観過多 = 注意 = red

const PC_CONFIG: Record<string, { color: string; badge: string }> = {
  extreme_fear:  { color: "text-violet-300", badge: "border-violet-400/30 bg-violet-400/[0.08] text-violet-300" },
  fear:          { color: "text-amber-400",  badge: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400" },
  neutral:       { color: "text-slate-400",  badge: "border-white/[0.18] bg-white/[0.06] text-slate-400" },
  greed:         { color: "text-[#34d399]",  badge: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" },
  extreme_greed: { color: "text-[#f87171]",  badge: "border-[#f87171]/30 bg-[#f87171]/[0.08] text-[#f87171]" },
};

// ── Fed トーン ────────────────────────────────────────────────────────────────

const FED_CONFIG: Record<string, { label: string; sub: string; color: string }> = {
  hawkish: {
    label: "タカ派（利上げ示唆）",
    sub:   "金利高止まり → 株式のバリュエーション圧迫。割引率上昇。",
    color: "border-[#f87171]/30 bg-[#f87171]/[0.06] text-[#f87171]",
  },
  dovish: {
    label: "ハト派（利下げ示唆）",
    sub:   "金利低下観測 → 株式への資金流入が起きやすい。",
    color: "border-[#34d399]/30 bg-[#34d399]/[0.06] text-[#34d399]",
  },
  neutral: {
    label: "中立",
    sub:   "Fed に明確な方向性なし。",
    color: "border-white/[0.12] bg-white/[0.06] text-slate-400",
  },
  none: {
    label: "Fed 言及なし",
    sub:   "今日のニュースには Fed の言及がない。",
    color: "border-white/[0.09] bg-white/[0.04] text-slate-500",
  },
};

// ── CRS インパクトバッジ ──────────────────────────────────────────────────────

const CRS_IMPACT_CONFIG = {
  positive: { label: "CRS↑方向",  color: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400" },
  neutral:  { label: "CRS影響小", color: "border-white/[0.18] bg-white/[0.06] text-slate-500" },
  negative: { label: "CRS↓方向",  color: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" },
};

// ─────────────────────────────────────────────────────────────────────────────

export default async function NewsPage() {
  // 1st: Supabase キャッシュ（cron が毎朝 7:00 JST に書き込む）
  let analysis: NewsAnalysis | null = null;
  let dataDate: string | null = null;
  let supabase: ReturnType<typeof getSupabaseServer> | null = null;

  try {
    supabase = getSupabaseServer();
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
  } catch { /* テーブル未作成 or DB エラーは無視 */ }

  // 2nd: キャッシュがなければライブフェッチ（初回 or cron 未実行時）
  if (!analysis) {
    try {
      const headlines = await fetchHeadlines();
      if (headlines.length > 0) {
        analysis = await analyzeNews(headlines);
        dataDate = new Date().toISOString().slice(0, 10);
        if (analysis && supabase) {
          await supabase.from("news_daily").upsert(
            {
              date:            dataDate,
              headlines:       headlines.map((h) => ({ title: h.title, source: h.source })),
              sentiment_score: analysis.sentiment_score,
              crisis_relevance:analysis.crisis_relevance,
              fed_tone:        analysis.fed_tone,
              main_topics:     analysis.main_topics,
              notable_events:  analysis.notable_events,
              raw_claude_output: analysis,
              model_used:      analysis.model_used,
            },
            { onConflict: "date" }
          ).then(() => {}, () => {});
        }
      }
    } catch { /* ライブフェッチも失敗したら null のまま */ }
  }

  // Put/Call 比率（独立取得）
  const pc = await fetchPutCallRatio().catch(() => null);

  // いいね数
  let likeCounts: Record<string, number> = {};
  if (analysis?.headlines_ja.length) {
    const ids = analysis.headlines_ja.map((h) => newsId(h.title));
    try {
      const sb = getSupabaseServer();
      await sb.from("news_items").upsert(
        analysis.headlines_ja.map((h, i) => ({
          id: ids[i], title_ja: h.title, source: h.source,
        })),
        { onConflict: "id", ignoreDuplicates: true }
      );
      const { data: reactions } = await sb
        .from("news_reactions").select("news_item_id").in("news_item_id", ids);
      for (const r of reactions ?? []) {
        const id = r.news_item_id as string;
        likeCounts[id] = (likeCounts[id] ?? 0) + 1;
      }
    } catch { /* social features optional */ }
  }

  const score    = analysis?.sentiment_score ?? 0;
  const smeta    = sentimentMeta(score);
  const barPct   = Math.round((score + 1) * 50);
  const crsImpact = (analysis?.crs_impact ?? "neutral") as "positive" | "negative" | "neutral";
  const phi2Watch = analysis?.phi2_watch ?? "";
  const syn      = analysis ? synthesize(score, pc, crsImpact) : null;

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
          <div className="mt-8 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-8 backdrop-blur-md text-center space-y-2">
            <p className="text-slate-400">ニュースの取得に失敗しました</p>
            <p className="font-mono text-[10px] text-slate-600">
              しばらくしてから再読み込みしてください（毎営業日 7:00 JST に自動更新）
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">

            {/* ① 今日の空気（総合判定）*/}
            {syn && (
              <div className={`rounded-2xl border px-5 py-4 backdrop-blur-sm ${syn.cls}`}>
                <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1.5 opacity-70">
                  今日の空気 — このサイトのロジックでは
                </p>
                <p className="text-lg font-semibold leading-snug">{syn.label}</p>
                <p className="mt-1 text-sm leading-6 opacity-80">{syn.text}</p>
              </div>
            )}

            {/* ② センチメント × Put/Call 比率 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {/* センチメント */}
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  市場センチメント
                </p>
                <div className="flex items-end gap-3">
                  <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${smeta.color}`}>
                    {score >= 0 ? "+" : ""}{score.toFixed(2)}
                  </span>
                  <span className={`mb-0.5 text-base font-semibold ${smeta.color}`}>{smeta.label}</span>
                </div>
                <div className="mt-4 relative h-1.5 w-full rounded-full bg-gradient-to-r from-[#f87171] via-slate-500/40 to-[#34d399]">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-4 w-1 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
                    style={{ left: `${barPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-600">
                  <span>弱気 −1</span><span>中立 0</span><span>強気 +1</span>
                </div>
                <p className="mt-3 font-mono text-[10px] text-slate-600">
                  Claude Haiku がニュースの論調を −1〜+1 で評価
                </p>
              </div>

              {/* Put/Call 比率 */}
              <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
                  Put / Call 比率（オプション市場）
                </p>
                {pc ? (
                  <>
                    <div className="flex items-end gap-3">
                      <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${PC_CONFIG[pc.level].color}`}>
                        {pc.value.toFixed(2)}
                      </span>
                      <span className={`mb-0.5 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${PC_CONFIG[pc.level].badge}`}>
                        {pc.label}
                      </span>
                    </div>
                    <p className="mt-3 text-xs leading-5 text-slate-400">{pc.note}</p>
                    <p className="mt-2 font-mono text-[10px] text-slate-600">
                      CBOE Equity Put/Call Ratio（^PCCE）· 高い＝恐怖 / 低い＝楽観
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-slate-600">取得できませんでした（市場クローズ後は非表示）</p>
                )}
              </div>
            </div>

            {/* ③ phi2・CRS との関係（phi2_watchがある場合のみ表示）*/}
            {(phi2Watch || crsImpact !== "neutral") && (
              <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8]/60">
                    phi2・CRS との関係 — このサイトのロジックでは
                  </p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] ${CRS_IMPACT_CONFIG[crsImpact].color}`}>
                    {CRS_IMPACT_CONFIG[crsImpact].label}
                  </span>
                </div>
                {phi2Watch ? (
                  <p className="text-sm leading-6 text-slate-300">{phi2Watch}</p>
                ) : (
                  <p className="text-sm leading-6 text-slate-500">
                    {crsImpact === "positive"
                      ? "今日のニュースはVIX上昇・信用収縮など、CRS成分を高める材料を含む。"
                      : "今日のニュースはリスク後退・安心材料が多く、CRS成分を下げる方向。"}
                  </p>
                )}
                <p className="mt-2 font-mono text-[10px] text-slate-600">
                  CRS（Crisis Recovery Score）はVIX・HYG・DXY・RSPなど6成分で構成。
                  phi2はCRS≥2の環境でのみ有効。
                </p>
              </div>
            )}

            {/* ④ Fed トーン */}
            {(() => {
              const fed = FED_CONFIG[analysis.fed_tone] ?? FED_CONFIG.none;
              return (
                <div className={`rounded-2xl border px-5 py-4 backdrop-blur-sm ${fed.color}`}>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-1.5">Fed / 金融政策</p>
                  <p className="font-semibold text-sm">{fed.label}</p>
                  <p className="mt-1 text-xs leading-5 opacity-70">{fed.sub}</p>
                </div>
              );
            })()}

            {/* ⑤ 特記事項 */}
            {analysis.notable_events && (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.04] px-5 py-3.5 backdrop-blur-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">特記事項</p>
                <p className="text-sm leading-6 text-slate-300">{analysis.notable_events}</p>
              </div>
            )}

            {/* ⑥ ヘッドライン */}
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
          ニュース分析: Claude Haiku（毎営業日 7:00 JST 自動更新）。Put/Call: CBOE ^PCCE。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
