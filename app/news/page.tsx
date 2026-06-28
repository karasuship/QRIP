import type { Metadata } from "next";
import { createHash } from "crypto";
import Link from "next/link";
import { fetchHeadlines } from "@/lib/news-fetch";
import { analyzeNews } from "@/lib/news-analyze";
import { getSupabaseServer } from "@/lib/supabase";
import type { NewsAnalysis } from "@/lib/news-analyze";
import type { PutCallData, RateData } from "@/lib/market-fetch";
import NewsSection from "./NewsSection";

export const metadata: Metadata = {
  title: "市場ニュース — 今日の相場と投資家心理",
  description: "株式市場の今日のニュースをAIが要約。センチメント・VIX・金利・待機資金など投資家心理を数値とわかりやすい言葉で毎営業日更新。",
};

export const revalidate = 3600;

function newsId(title: string): string {
  return createHash("sha256").update(title).digest("hex").slice(0, 32);
}

// ── 今日の雰囲気（総合判定）────────────────────────────────────────────────────
// 憲法第三条「恐怖と過熱を分ける」を一般ユーザー向けの言葉で実装する。
// 「phi2」「センチメント」などの専門用語はこのカードには出さない。

function synthesize(
  score: number,
  pc: PutCallData | null,
  crsImpact: "positive" | "negative" | "neutral",
): { label: string; text: string; cls: string } {
  const fearByScore = score <= -0.25;
  const fearByPC    = pc && (pc.level === "fear" || pc.level === "extreme_fear");
  const heatByScore = score >= 0.30;
  const heatByPC    = pc && pc.level === "extreme_greed";

  if (fearByScore && fearByPC) return {
    label: "警戒ムード",
    text:  "ニュースの論調も、プロの投資家の動きも、どちらも「怖い」方向を向いています。待機資金の出番が近い可能性があります。",
    cls:   "border-[#f87171]/40 bg-[#f87171]/[0.08] text-[#f87171]",
  };
  if (fearByScore || fearByPC) return {
    label: "やや警戒",
    text: crsImpact === "positive"
      ? "下落圧力があり、ニュースにも不安材料が含まれています。急変しやすい環境です。"
      : "弱気寄りですが、本格的な恐怖のピークにはまだ達していません。",
    cls:   "border-amber-400/40 bg-amber-400/[0.08] text-amber-400",
  };
  if (heatByScore && heatByPC) return {
    label: "強気・過熱",
    text:  "ニュースも投資家心理も楽観的です。このタイミングで急いで追加投資するより、待機資金を温存する局面です。",
    cls:   "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]",
  };
  if (heatByScore || heatByPC) return {
    label: "やや強気",
    text:  "少し前向きな雰囲気ですが、過熱感は限定的です。通常どおりの積立継続で十分です。",
    cls:   "border-[#34d399]/30 bg-[#34d399]/[0.05] text-[#34d399]",
  };
  if (crsImpact === "positive") return {
    label: "材料が混在",
    text:  "全体は落ち着いていますが、一部に不安材料が含まれます。急な変化に備えて状況を注視してください。",
    cls:   "border-amber-400/30 bg-amber-400/[0.06] text-amber-300",
  };
  return {
    label: "平穏",
    text:  "特に大きな変化はありません。通常の積立を継続してください。",
    cls:   "border-white/[0.22] bg-white/[0.11] text-slate-300",
  };
}

// ── センチメントの言語化 ──────────────────────────────────────────────────────

function sentimentMeta(score: number) {
  if (score >= 0.5)  return { label: "かなり前向き",  color: "text-[#34d399]" };
  if (score >= 0.25) return { label: "やや前向き",    color: "text-[#34d399]" };
  if (score <= -0.5) return { label: "かなり後ろ向き", color: "text-[#f87171]" };
  if (score <= -0.25)return { label: "やや後ろ向き",  color: "text-[#f87171]" };
  return { label: "どちらでもない", color: "text-slate-400" };
}

// ── Put/Call の表示設定 ───────────────────────────────────────────────────────
// 恐怖 = 待機資金の出番に近い = violet/amber（CRSと色を統一）
// 楽観過多 = 過熱リスク = red

const PC_CONFIG: Record<string, { color: string; badge: string; label: string }> = {
  extreme_fear:  { color: "text-violet-300", badge: "border-violet-400/30 bg-violet-400/[0.08] text-violet-300", label: "歴史的な恐怖水準" },
  fear:          { color: "text-amber-400",  badge: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400",   label: "下落への備えが多い" },
  neutral:       { color: "text-slate-400",  badge: "border-white/[0.18] bg-white/[0.11] text-slate-400",       label: "どちらでもない" },
  greed:         { color: "text-[#34d399]",  badge: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]",  label: "上昇への期待が多い" },
  extreme_greed: { color: "text-[#f87171]",  badge: "border-[#f87171]/30 bg-[#f87171]/[0.08] text-[#f87171]",  label: "楽観が行きすぎ" },
};

// ── 金利の表示設定 ────────────────────────────────────────────────────────────

const TNX_LEVEL: Record<string, { label: string; note: string; color: string }> = {
  low:  { label: "低め（お金が借りやすい）",     note: "株より債券の魅力が小さく、株に資金が向きやすい状態です。",  color: "text-[#34d399]" },
  mid:  { label: "中程度",                       note: "株と債券のバランスが取れた水準です。",                    color: "text-slate-300" },
  high: { label: "やや高め（お金が借りにくい）", note: "安全な債券でも利回りが出るため、株の比較優位が下がります。", color: "text-amber-400" },
};

const CURVE_SHAPE: Record<string, { label: string; note: string; color: string }> = {
  normal:   { label: "正常（長期 > 短期）",   note: "経済が普通に機能している状態です。", color: "text-[#34d399]" },
  flat:     { label: "フラット（ほぼ同水準）", note: "景気の先行きに不透明感が出ています。", color: "text-amber-400" },
  inverted: { label: "逆イールド（短期 > 長期）", note: "過去のデータでは景気後退の前に現れやすいパターンです。", color: "text-[#f87171]" },
};

// ── Fed トーン ────────────────────────────────────────────────────────────────

const FED_CONFIG: Record<string, { label: string; plain: string; color: string }> = {
  hawkish: {
    label: "引き締め方向（利上げ寄り）",
    plain: "金利を上げると企業がお金を借りにくくなり、株の理論的な価値が下がりやすくなります。",
    color: "border-[#f87171]/30 bg-[#f87171]/[0.06] text-[#f87171]",
  },
  dovish: {
    label: "緩和方向（利下げ寄り）",
    plain: "金利を下げるとお金が借りやすくなり、株式市場に資金が向かいやすくなります。",
    color: "border-[#34d399]/30 bg-[#34d399]/[0.06] text-[#34d399]",
  },
  neutral: {
    label: "中立（様子見）",
    plain: "今のところ金利の方向性について明確な姿勢は示されていません。",
    color: "border-white/[0.22] bg-white/[0.11] text-slate-400",
  },
  none: {
    label: "今日は言及なし",
    plain: "今日のニュースには中央銀行についての話題が特にありませんでした。",
    color: "border-white/[0.09] bg-white/[0.14] text-slate-500",
  },
};

// ── CRS インパクトバッジ（phi2 セクション用）────────────────────────────────

const CRS_IMPACT_CONFIG = {
  positive: { label: "不安材料あり", color: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400" },
  neutral:  { label: "影響は小さい", color: "border-white/[0.18] bg-white/[0.11] text-slate-500" },
  negative: { label: "安心材料あり", color: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" },
};

// ─────────────────────────────────────────────────────────────────────────────

export default async function NewsPage() {
  // 1st: Supabase キャッシュ
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
  } catch { /* DB エラーは無視 */ }

  // 2nd: ライブフェッチ（キャッシュなし時）
  if (!analysis) {
    try {
      const headlines = await fetchHeadlines();
      if (headlines.length > 0) {
        analysis = await analyzeNews(headlines);
        dataDate = new Date().toISOString().slice(0, 10);
        if (analysis && supabase) {
          await supabase.from("news_daily").upsert(
            {
              date: dataDate,
              headlines: headlines.map((h) => ({ title: h.title, source: h.source })),
              sentiment_score:  analysis.sentiment_score,
              crisis_relevance: analysis.crisis_relevance,
              fed_tone:         analysis.fed_tone,
              main_topics:      analysis.main_topics,
              notable_events:   analysis.notable_events,
              raw_claude_output: analysis,
              model_used:       analysis.model_used,
            },
            { onConflict: "date" }
          ).then(() => {}, () => {});
        }
      }
    } catch { /* ライブフェッチ失敗は無視 */ }
  }

  // 市場データ（Supabase market_daily から — cron が毎朝7時に蓄積済み）
  // 外部 API を呼ばないことで ISR キャッシュが正常に機能する
  let pc: PutCallData | null = null;
  let mmf: { current_billions: number; avg_52w_billions: number; max_52w: number; min_52w: number; fuel_score: number; last_date: string } | null = null;
  let rates: RateData | null = null;
  try {
    const mdb = getSupabaseServer();
    const { data: md } = await mdb
      .from("market_daily")
      .select("date, put_call_ratio, tnx, irx, yield_3m_10, mmf_total, mmf_retail, mmf_institutional")
      .order("date", { ascending: false })
      .limit(1)
      .single();

    if (md) {
      // Put/Call（^CPCE 総合）
      if (md.put_call_ratio != null) {
        const v = md.put_call_ratio as number;
        let level: PutCallData["level"] = "neutral";
        let label = "どちらでもない";
        let note  = "恐怖も楽観も偏りなし。";
        if (v > 1.10) { level = "extreme_fear"; label = "歴史的な恐怖水準"; note = "過去の暴落局面に近い水準。"; }
        else if (v > 0.88) { level = "fear";    label = "下落への備えが多い"; note = "ヘッジ需要が高まっています。"; }
        else if (v > 0.72) { level = "neutral"; }
        else if (v > 0.55) { level = "greed";   label = "上昇への期待が多い"; note = "リスク選好環境。"; }
        else { level = "extreme_greed"; label = "楽観が行きすぎ"; note = "コール買い過多。相場の天井付近に注意。"; }
        pc = { value: Math.round(v * 1000) / 1000, date: md.date as string, level, label, note };
      }

      // 金利
      const tnx = md.tnx as number | null;
      const irx = md.irx as number | null;
      if (tnx != null && irx != null) {
        const spreadBp = Math.round((tnx - irx) * 100);
        rates = {
          tnx: Math.round(tnx * 100) / 100,
          irx: Math.round(irx * 100) / 100,
          spreadBp,
          date: md.date as string,
          tnxLevel: tnx < 3 ? "low" : tnx < 4.5 ? "mid" : "high",
          curveShape: spreadBp < -50 ? "inverted" : spreadBp < 50 ? "flat" : "normal",
        };
      }

      // MMF（FRED API を呼ばない。Supabase から概算を作る）
      const total = (md.mmf_total as number | null) ?? ((md.mmf_retail as number | null) ?? 0) + ((md.mmf_institutional as number | null) ?? 0);
      if (total > 0) {
        // fuel_score はレンジ情報がないので簡易計算（6000B = max 想定）
        const approxFuelScore = Math.min(10, Math.max(0, Math.round((total / 7000) * 10)));
        mmf = {
          current_billions: Math.round(total),
          avg_52w_billions: Math.round(total * 0.97),
          max_52w: Math.round(total * 1.05),
          min_52w: Math.round(total * 0.90),
          fuel_score: approxFuelScore,
          last_date: md.date as string,
        };
      }
    }
  } catch { /* market_daily が空の場合は null のまま */ }

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
    } catch { /* social optional */ }
  }

  const score      = analysis?.sentiment_score ?? 0;
  const smeta      = sentimentMeta(score);
  const barPct     = Math.round((score + 1) * 50);
  const crsImpact  = (analysis?.crs_impact ?? "neutral") as "positive" | "negative" | "neutral";
  const phi2Watch  = analysis?.phi2_watch ?? "";
  const syn        = analysis ? synthesize(score, pc, crsImpact) : null;

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

        {syn && (
          <div className={`mt-4 rounded-2xl border px-5 py-4 backdrop-blur-sm ${syn.cls}`}>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1.5 opacity-60">今日の雰囲気</p>
            <p className="text-lg font-semibold leading-snug">{syn.label}</p>
            <p className="mt-1 text-sm leading-6 opacity-80">{syn.text}</p>
          </div>
        )}

        {!analysis ? (
          <div className="mt-8 rounded-2xl border border-white/[0.22] bg-white/[0.11] p-8 backdrop-blur-md text-center space-y-2">
            <p className="text-slate-400">ニュースの取得に失敗しました</p>
            <p className="font-mono text-[10px] text-slate-500">
              しばらくしてから再読み込みしてください（毎営業日 7:00 JST に自動更新）
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-4">

            {/* ① ニュースの論調 × 投資家の警戒度 */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {/* ニュースの論調（センチメント） */}
              <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                  今日のニュースは前向きか後ろ向きか
                </p>
                <div className="flex items-end gap-3 mt-3">
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
                <div className="mt-1.5 flex justify-between font-mono text-[10px] text-slate-500">
                  <span>後ろ向き −1</span><span>中立 0</span><span>前向き +1</span>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-500">
                  AIが英語ニュース全体の論調を評価した数値。プラスが大きいほど良いニュースが多い。
                </p>
              </div>

              {/* 投資家の警戒度（Put/Call） */}
              <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                  プロの投資家はどちら側に備えているか
                </p>
                {pc ? (
                  <>
                    <div className="flex items-end gap-3 mt-3">
                      <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${PC_CONFIG[pc.level].color}`}>
                        {pc.value.toFixed(2)}
                      </span>
                      <span className={`mb-0.5 inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-xs ${PC_CONFIG[pc.level].badge}`}>
                        {PC_CONFIG[pc.level].label}
                      </span>
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-400">{pc.note}</p>
                    <p className="mt-2 text-[10px] leading-5 text-slate-500">
                      「下落保険（プット）」と「上昇賭け（コール）」の比率。1.0超えは本格的な警戒水準。
                      <span className="text-slate-500"> （CBOE ^PCCE）</span>
                    </p>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">市場クローズ後は取得できません</p>
                )}
              </div>
            </div>

            {/* ③ 待機資金の規模（MMF） */}
            {mmf && (
              <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">
                  株式市場に流れ込める「待機資金」はどれくらいあるか
                </p>
                <div className="flex items-end gap-3 mt-3 mb-3">
                  <span className={`font-mono text-4xl font-bold tabular-nums leading-none ${
                    mmf.fuel_score >= 7 ? "text-[#34d399]" : mmf.fuel_score >= 4 ? "text-amber-400" : "text-slate-400"
                  }`}>{mmf.fuel_score}<span className="text-lg text-slate-500">/10</span></span>
                  <span className="mb-1 text-sm text-slate-400">
                    残高 <span className="font-mono font-semibold text-slate-300">${mmf.current_billions.toLocaleString()}B</span>
                    <span className="ml-2 text-slate-500 text-xs">（52週 最小 ${mmf.min_52w.toLocaleString()}B → 最大 ${mmf.max_52w.toLocaleString()}B）</span>
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-white/[0.11] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      mmf.fuel_score >= 7 ? "bg-[#34d399]" : mmf.fuel_score >= 4 ? "bg-amber-400" : "bg-slate-500"
                    }`}
                    style={{ width: `${mmf.fuel_score * 10}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-5 text-slate-500">
                  MMF（普通預金より安全で利回りが出る短期金融商品）に眠っているお金の総量。
                  これが多いほど、相場が回復したときに株式市場へ流れ込む「燃料」が豊富な状態。
                  <span className="text-slate-500">（データ: FRED WRMFSL、{mmf.last_date}時点）</span>
                </p>
              </div>
            )}

            {/* ④ 金利環境 */}
            {rates && (
              <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-4">
                  お金を借りるコスト（金利）はどうなっているか
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* 長期金利 */}
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.11] px-4 py-3">
                    <p className="font-mono text-[10px] text-slate-500 mb-1">米国の長期金利（10年）</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono text-2xl font-bold tabular-nums ${TNX_LEVEL[rates.tnxLevel].color}`}>
                        {rates.tnx.toFixed(2)}%
                      </span>
                      <span className={`text-xs font-medium ${TNX_LEVEL[rates.tnxLevel].color}`}>
                        {TNX_LEVEL[rates.tnxLevel].label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      {TNX_LEVEL[rates.tnxLevel].note}
                    </p>
                  </div>
                  {/* イールドカーブ */}
                  <div className="rounded-xl border border-white/[0.09] bg-white/[0.11] px-4 py-3">
                    <p className="font-mono text-[10px] text-slate-500 mb-1">金利の形（イールドカーブ）</p>
                    <div className="flex items-baseline gap-2">
                      <span className={`font-mono text-sm font-bold ${CURVE_SHAPE[rates.curveShape].color}`}>
                        {rates.curveShape === "inverted" ? "▼" : rates.curveShape === "normal" ? "▲" : "→"}
                        {" "}{CURVE_SHAPE[rates.curveShape].label}
                      </span>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                      {CURVE_SHAPE[rates.curveShape].note}
                    </p>
                    <p className="mt-1 font-mono text-[9px] text-slate-500">
                      10年債 {rates.tnx}% 〔−〕 3ヶ月 {rates.irx}% ＝ {rates.spreadBp > 0 ? "+" : ""}{rates.spreadBp}bp
                    </p>
                  </div>
                </div>
                {/* 備考: なぜシグナルに使わないか */}
                <p className="mt-3 text-[10px] leading-5 text-slate-500 border-t border-white/[0.07] pt-3">
                  ※ このサイトの買いシグナル（phi2）は金利を使っていません。
                  理由: 金利が高いと株に悪いはずが、量的緩和（QE）期には逆の動きをすることが30年データで確認されたためです。
                  金利はあくまで「現在の相場環境の背景」として参考にしてください。
                </p>
              </div>
            )}

            {/* ⑤ アメリカ中央銀行（Fed）のスタンス */}
            {(() => {
              const fed = FED_CONFIG[analysis.fed_tone] ?? FED_CONFIG.none;
              return (
                <div className={`rounded-2xl border px-5 py-4 backdrop-blur-sm ${fed.color}`}>
                  <p className="font-mono text-[10px] uppercase tracking-widest opacity-60 mb-1.5">
                    アメリカの中央銀行（Fed）の姿勢
                  </p>
                  <p className="font-semibold text-sm">{fed.label}</p>
                  <p className="mt-1 text-xs leading-5 opacity-70">{fed.plain}</p>
                </div>
              );
            })()}

            {/* ⑥ このサイトの買い判定との関係（phi2_watchがある場合のみ） */}
            {(phi2Watch || crsImpact !== "neutral") && (
              <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-2">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8]/60">
                    このサイトの「買いタイミング判定」との関係
                  </p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[9px] ${CRS_IMPACT_CONFIG[crsImpact].color}`}>
                    {CRS_IMPACT_CONFIG[crsImpact].label}
                  </span>
                </div>
                <p className="text-sm leading-6 text-slate-300">
                  {phi2Watch || (
                    crsImpact === "positive"
                      ? "今日のニュースには、恐怖スコア（CRS）を押し上げるような不安材料が含まれています。"
                      : "今日のニュースは安心材料が多く、恐怖スコア（CRS）を下げる方向の内容です。"
                  )}
                </p>
                <p className="mt-2 text-[10px] leading-5 text-slate-500">
                  CRSは「市場の恐怖の深さ」を0〜6で数値化したスコアです。
                  phi2シグナルはCRS 2以上の環境でのみ有効になります。
                  <Link href="/learn" className="ml-1 text-[#38bdf8]/50 hover:text-[#38bdf8] transition-colors">→ 詳細</Link>
                </p>
              </div>
            )}

            {/* ⑦ 特記事項 */}
            {analysis.notable_events && (
              <div className="rounded-2xl border border-white/[0.09] bg-white/[0.14] px-5 py-3.5 backdrop-blur-sm">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">今日の注目ポイント</p>
                <p className="text-sm leading-6 text-slate-300">{analysis.notable_events}</p>
              </div>
            )}

            {/* ⑧ ヘッドライン */}
            {newsItems.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">
                  今日の主要ニュース（クリックで解説）
                </p>
                <NewsSection items={newsItems} />
              </div>
            )}

          </div>
        )}

        <p className="mt-8 font-mono text-[10px] leading-5 text-slate-500">
          ニュース分析: Claude Haiku（毎営業日 7:00 JST 自動更新）。Put/Call: CBOE ^PCCE。金利: Yahoo Finance ^TNX / ^IRX。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
