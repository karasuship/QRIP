import Link from "next/link";
import { fetchSignal } from "@/lib/signal";
import { getSupabaseServer } from "@/lib/supabase";
import type { Metadata } from "next";
import WatchlistPanel from "@/app/components/WatchlistPanel";
import CollapseSection from "@/app/components/CollapseSection";
import PortfolioPatterns from "@/app/components/PortfolioPatterns";

export const metadata: Metadata = {
  title: "株の買い場を30年統計で判定 — phi2・CRS シグナル",
  description:
    "暴落で投げ売りする前に。S&P500・ETF・日本株の買い場シグナルを30年バックテストで検証し、毎日リアルタイム判定。スクリーナー・30年試算・検証書庫を統合。",
};

export const revalidate = 900;

// ── 判定テキスト ──────────────────────────────────────────────────
function toVerdict(tier: string, athDd: number) {
  const drop = Math.abs(athDd * 100).toFixed(1);
  const map: Record<string, { label: string; sub: string; dot: string; badge: string }> = {
    DOUBLE: {
      label: "強い買い場",
      sub: "30年で8回しか見たことのない水準の急落",
      dot: "bg-violet-400 shadow-violet-400/40",
      badge: "border-violet-400/40 bg-violet-400/[0.10] text-violet-300",
    },
    PHI2: {
      label: "買い場",
      sub: `高値から${drop}%下落。過去30年の類似局面、2ヶ月後の平均リターンが通常の約2倍`,
      dot: "bg-[#34d399] shadow-[#34d399]/40",
      badge: "border-[#34d399]/40 bg-[#34d399]/[0.10] text-[#34d399]",
    },
    NEAR: {
      label: "条件待ち",
      sub: `高値から${drop}%下落。あと少しで発動条件が揃う`,
      dot: "bg-amber-400 shadow-amber-400/40",
      badge: "border-amber-400/30 bg-amber-400/[0.07] text-amber-400",
    },
    RSI25: {
      label: "弱いシグナル",
      sub: "短期的な売られすぎ。単独での根拠としては薄い",
      dot: "bg-slate-400",
      badge: "border-white/[0.15] bg-white/[0.11] text-slate-400",
    },
    NONE: {
      label: "様子見",
      sub: `高値からまだ${drop}%しか下がっていない。定期積立の継続が合理的`,
      dot: "bg-slate-600",
      badge: "border-white/[0.22] bg-white/[0.14] text-slate-500",
    },
  };
  return map[tier] ?? map.NONE;
}

const CRS_LABEL = ["低危機", "低危機", "注視", "注視", "高危機", "高危機", "極度危機"];

const PAST_SIGNALS = [
  { period: "2020年3月", context: "コロナショック",     drop: "−34%", ret: "+40%", note: "1ヶ月で株価が3分の2に。底で判定が出た。" },
  { period: "2018年12月", context: "米中貿易戦争",      drop: "−20%", ret: "+20%", note: "クリスマス直前の急落。FRBへの不信感が重なった。" },
  { period: "2023年10月", context: "中東紛争・金利不安", drop: "−11%", ret: "+14%", note: "イスラエル・ハマス衝突と長期金利5%超が重なった。" },
  { period: "2022年9月", context: "インフレ・急激な利上げ", drop: "−25%", ret: "+11%", note: "40年ぶりのインフレ。FRBが前例のない速度で利上げした。" },
];

const SIM_TIERS = [
  { label: "月3万", years: 30, result: "約6,600万円", principal: "元本1,080万" },
  { label: "月5万", years: 30, result: "約1.1億円",   principal: "元本1,800万", highlight: true },
  { label: "月10万", years: 30, result: "約2.2億円",  principal: "元本3,600万" },
];

export default async function HomePage() {
  // シグナルデータ
  let tier = "NONE";
  let athDd = 0;
  let crs = 0;
  let price = 0;
  let dayRet: number | null = null;
  let date = "";

  try {
    const sig = await fetchSignal();
    tier   = sig.signalTier;
    athDd  = sig.athDd;
    crs    = sig.crs;
    price  = sig.price;
    dayRet = sig.dayRet;
    date   = sig.date;
  } catch { /* silent */ }

  const v = toVerdict(tier, athDd);

  // 仮説（最大3件）
  interface Hypothesis { id: number; title: string; status: string; vote_count: number; }
  let recentHypotheses: Hypothesis[] = [];
  try {
    const db = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (db as any)
      .from("hypotheses")
      .select("id, title, status, vote_count")
      .order("vote_count", { ascending: false })
      .limit(3);
    recentHypotheses = (data ?? []) as Hypothesis[];
  } catch { /* silent */ }

  const STATUS_LABEL: Record<string, string> = {
    open: "検証待ち", testing: "検証中", adopted: "採用", rejected: "棄却",
  };
  const STATUS_CLS: Record<string, string> = {
    open: "text-[#38bdf8]", testing: "text-amber-400", adopted: "text-[#34d399]", rejected: "text-slate-500",
  };

  return (
    <div className="min-h-screen">

      {/* ━━━ 指令センター ━━━ */}
      <div className="border-b border-white/[0.15] bg-gradient-to-b from-sky-400/[0.04] to-transparent">
        <div className="mx-auto max-w-4xl px-6 py-10">

          {/* ヘッダー行 */}
          <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#38bdf8]/50">QRIP · 指令センター</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#e8f4ff]">
                売る根拠も、買い足す根拠も、持ち続ける根拠も。
              </h1>
            </div>
            {date && <p className="font-mono text-[10px] text-slate-500">{date} · 15分キャッシュ</p>}
          </div>

          {/* ダッシュボードグリッド */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

            {/* 今日の判定 */}
            <Link
              href="/signal"
              className={`col-span-2 rounded-2xl border px-5 py-4 backdrop-blur-sm transition-all hover:brightness-110 ${v.badge}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`h-2 w-2 rounded-full shadow-lg ${v.dot} animate-pulse`} />
                <p className="font-mono text-[9px] uppercase tracking-widest opacity-60">今日の判定</p>
              </div>
              <p className="text-2xl font-bold tracking-tight">{v.label}</p>
              <p className="mt-1.5 text-[11px] leading-5 opacity-70">{v.sub}</p>
              <p className="mt-3 font-mono text-[9px] opacity-40">詳細を見る →</p>
            </Link>

            {/* CRS スコア */}
            <Link
              href="/signal/sp500"
              className="rounded-2xl border border-white/[0.22] bg-white/[0.14] px-4 py-4 backdrop-blur-sm transition-all hover:bg-white/[0.13]"
            >
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">CRS スコア</p>
              <p className={`font-mono text-3xl font-bold ${crs >= 5 ? "text-[#f87171]" : crs >= 3 ? "text-amber-400" : crs >= 2 ? "text-[#38bdf8]" : "text-slate-400"}`}>
                {crs}<span className="text-base font-normal text-slate-500">/6</span>
              </p>
              {/* バー */}
              <div className="mt-2.5 flex gap-0.5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      i < crs
                        ? crs >= 5 ? "bg-[#f87171]" : crs >= 3 ? "bg-amber-400" : "bg-[#38bdf8]"
                        : "bg-white/[0.14]"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[9px] text-slate-500">{CRS_LABEL[crs] ?? "—"}</p>
            </Link>

            {/* SP500 */}
            <div className="rounded-2xl border border-white/[0.22] bg-white/[0.14] px-4 py-4 backdrop-blur-sm">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">S&amp;P 500</p>
              <p className="font-mono text-2xl font-bold text-[#e8f4ff] tabular-nums">
                {price > 0 ? price.toLocaleString("ja-JP", { maximumFractionDigits: 0 }) : "—"}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                {dayRet !== null && (
                  <span className={`font-mono text-xs font-semibold ${dayRet >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                    {dayRet >= 0 ? "+" : ""}{(dayRet * 100).toFixed(2)}%
                  </span>
                )}
                <span className="font-mono text-[9px] text-slate-500">
                  ATH {athDd >= 0 ? "+" : ""}{(athDd * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* ウォッチリスト */}
          <WatchlistPanel />

          {/* クイックナビ */}
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              { href: "/screener", label: "銘柄スクリーナー", cls: "text-slate-400 border-white/[0.18] bg-white/[0.11]" },
              { href: "/news",     label: "最新ニュース",     cls: "text-slate-400 border-white/[0.18] bg-white/[0.11]" },
              { href: "/simulate", label: "30年試算",         cls: "text-amber-400/70 border-amber-400/15 bg-amber-400/[0.04]" },
              { href: "/mypage",   label: "マイページ",       cls: "text-[#38bdf8]/70 border-[#38bdf8]/15 bg-[#38bdf8]/[0.04]" },
            ].map(({ href, label, cls }) => (
              <Link
                key={href}
                href={href}
                className={`rounded-xl border px-3 py-1.5 font-mono text-[10px] transition-all hover:brightness-125 ${cls}`}
              >
                {label} →
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ━━━ 積立パターン比較 ━━━ */}
      <PortfolioPatterns />

      {/* ━━━ 過去の買い場 ━━━ */}
      <CollapseSection badge="過去の実績" title="「買い場」と判定した日、その後どうなったか">
        <p className="text-xs text-slate-500 mb-6">
          判定から2ヶ月後（約63営業日）のS&amp;P 500リターン。
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.22]">
          {PAST_SIGNALS.map((s, i) => (
            <div
              key={s.period}
              className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 ${
                i !== PAST_SIGNALS.length - 1 ? "border-b border-white/[0.15]" : ""
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-0.5">
                  <span className="font-mono text-xs text-slate-400">{s.period}</span>
                  <span className="rounded-full border border-white/[0.18] bg-white/[0.14] px-2 py-0.5 font-mono text-[9px] text-slate-500">
                    {s.context}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">{s.note}</p>
              </div>
              <div className="flex items-center gap-6 sm:shrink-0">
                <div className="text-center">
                  <p className="font-mono text-[9px] text-slate-500 mb-0.5">高値からの下落</p>
                  <p className="font-mono text-sm font-bold text-[#f87171]">{s.drop}</p>
                </div>
                <div className="font-mono text-slate-500 text-lg">→</div>
                <div className="text-center">
                  <p className="font-mono text-[9px] text-slate-500 mb-0.5">2ヶ月後</p>
                  <p className="font-mono text-sm font-bold text-[#34d399]">{s.ret}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 font-mono text-[9px] text-slate-500">
          過去30年（1994〜2024）の検証結果。将来のリターンを保証するものではありません。
        </p>
      </CollapseSection>

      {/* ━━━ シミュレーション ━━━ */}
      <CollapseSection badge="試算" title="「なんとなく売らない」のではなく、数字で持ち続ける。">
        <p className="text-xs text-slate-500 mb-6">
          毎月一定額を30年積み立てた場合のシミュレーション（年利10%想定 / S&amp;P 500の長期平均値）。
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
          {SIM_TIERS.map((t) => (
            <div
              key={t.label}
              className={`rounded-2xl border px-5 py-4 ${
                t.highlight
                  ? "border-amber-400/30 bg-amber-400/[0.06]"
                  : "border-white/[0.18] bg-white/[0.11]"
              }`}
            >
              <p className="font-mono text-xs text-slate-500 mb-1">{t.label} × {t.years}年</p>
              <p className={`font-mono text-2xl font-bold ${t.highlight ? "text-amber-300" : "text-[#e8f4ff]"}`}>
                {t.result}
              </p>
              <p className="font-mono text-[10px] text-slate-500 mt-1">{t.principal}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-5 py-3 mb-5">
          <p className="text-[11px] leading-6 text-slate-500">
            コロナショック時（2020年3月）に1,000万円のポートフォリオを損切りし、1年後に戻した場合、
            その間に市場は <span className="text-[#f87171] font-mono font-bold">+79%</span> 上昇した。
            "暴落時に売る"コストは、感覚よりずっと大きい。
          </p>
        </div>
        <Link
          href="/simulate"
          className="inline-flex items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.05] px-4 py-2 font-mono text-xs text-amber-400 hover:bg-amber-400/[0.10] transition-all"
        >
          自分の数字で試算する →
        </Link>
      </CollapseSection>

      {/* ━━━ 検証の透明性 ━━━ */}
      <CollapseSection badge="検証書庫" title="なぜこの数字を信じていいのか。根拠ごと全部公開。">
        <p className="text-xs text-slate-500 mb-6">
          採用したシグナルだけでなく、棄却した仮説とその理由もすべてアーカイブしている。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
          {[
            { num: "30年", desc: "1994〜2024年のデータを使用" },
            { num: "90+",  desc: "検証した仮説の数" },
            { num: "5本",  desc: "最終的に採用したシグナル" },
            { num: "全公開", desc: "採用・棄却の理由を全てアーカイブ" },
          ].map((s) => (
            <div key={s.num} className="rounded-xl border border-white/[0.18] bg-white/[0.11] px-4 py-3 text-center">
              <p className="font-mono text-xl font-bold text-[#e8f4ff]">{s.num}</p>
              <p className="font-mono text-[9px] text-slate-500 mt-1 leading-4">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="space-y-2 mb-6">
          {[
            { label: "採用", name: "phi2 v3",               stat: "30年・2ヶ月後リターンが通常の約2倍" },
            { label: "採用", name: "RSI<25 シグナル",        stat: "TEST 勝率90%。phi2と重複率5%のほぼ独立したシグナル" },
            { label: "棄却", name: "金利シグナル（TNX・IRX）", stat: "QE前後で意味が完全逆転。体制依存のため採用不可" },
            { label: "棄却", name: "分割買い（2〜4回に分散投入）", stat: "全額即日投入が最良。分割するほどアルファが逃げる" },
          ].map((r) => (
            <div key={r.name} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
              <span className={`font-mono text-[9px] shrink-0 pt-0.5 ${r.label === "採用" ? "text-[#34d399]" : "text-[#f87171]/60"}`}>
                {r.label}
              </span>
              <div>
                <p className="font-mono text-xs text-slate-400">{r.name}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{r.stat}</p>
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/research"
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.22] bg-white/[0.14] px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.13] transition-all"
        >
          全ての検証記録を読む（採用5本・棄却7本+）→
        </Link>
      </CollapseSection>

      {/* ━━━ 仮説投票 ━━━ */}
      <CollapseSection badge="仮説投票" title="「これも調べてほしい」を投稿する。" border={false}>
        <p className="text-xs text-slate-500 mb-6">
          投票数の多い仮説を優先的に検証する。採用・棄却の結果は書庫に公開。
        </p>
        {recentHypotheses.length > 0 ? (
          <div className="space-y-2 mb-5">
            {recentHypotheses.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/[0.15] bg-white/[0.02] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{h.title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-[9px] ${STATUS_CLS[h.status] ?? "text-slate-500"}`}>
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                  <span className="font-mono text-[10px] text-slate-500">▲ {h.vote_count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-white/[0.15] bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-xs text-slate-500">まだ仮説がありません。最初の1件を投稿してみてください。</p>
          </div>
        )}
        <Link
          href="/hypotheses"
          className="inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-4 py-2 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/[0.08] transition-all"
        >
          仮説の一覧と投稿フォームを見る →
        </Link>
      </CollapseSection>

    </div>
  );
}
