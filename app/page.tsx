import Link from "next/link";
import { fetchSignal } from "@/lib/signal";
import { getSupabaseServer } from "@/lib/supabase";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QRIP — 売る根拠も、買う根拠も、持ち続ける根拠も。",
  description:
    "30年分の相場データを毎日スキャンし、今日「買い場か」を判定する。シグナル・試算・検証書庫・仮説投票を統合した統計ベースの投資判断支援ツール。",
};

export const revalidate = 900;

function toPlainJapanese(
  signalTier: string,
  athDd: number
): { verdict: string; reason: string; cls: string; dot: string } {
  const drop = Math.abs(athDd * 100).toFixed(1);
  switch (signalTier) {
    case "DOUBLE":
      return {
        verdict: "強い買い場",
        reason: "30年間で8回しか見たことのない水準の急落。コロナショック・リーマンショックと同じ条件が揃っている。",
        cls: "border-violet-400/40 bg-violet-400/[0.07] text-violet-300",
        dot: "bg-violet-400",
      };
    case "PHI2":
      return {
        verdict: "買い場",
        reason: `高値から ${drop}% 下落。過去30年の同じ条件、2ヶ月後の平均リターンは通常の約2倍だった。`,
        cls: "border-[#34d399]/40 bg-[#34d399]/[0.07] text-[#34d399]",
        dot: "bg-[#34d399]",
      };
    case "NEAR":
      return {
        verdict: "条件待ち",
        reason: `高値から ${drop}% 下落。あと少しで「買い場」の条件が揃う。定期積立を続けながら待つ局面。`,
        cls: "border-amber-400/25 bg-amber-400/[0.05] text-amber-400",
        dot: "bg-amber-400",
      };
    case "RSI25":
      return {
        verdict: "弱いシグナル",
        reason: "短期的に売られすぎているが、単独では根拠として薄い。定期積立の継続が無難。",
        cls: "border-white/[0.20] bg-white/[0.06] text-slate-300",
        dot: "bg-slate-400",
      };
    default:
      return {
        verdict: "様子見",
        reason: `高値からまだ ${drop}% しか下がっていない。焦って動くより、毎月の定期積立を続けるほうが合理的。`,
        cls: "border-white/[0.15] bg-white/[0.06] text-slate-400",
        dot: "bg-slate-600",
      };
  }
}

const PAST_SIGNALS = [
  {
    period: "2020年3月",
    context: "コロナショック",
    drop: "−34%",
    ret: "+40%",
    note: "1ヶ月で株価が3分の2に。底で判定が出た。",
  },
  {
    period: "2018年12月",
    context: "米中貿易戦争",
    drop: "−20%",
    ret: "+20%",
    note: "クリスマス直前の急落。FRBへの不信感が重なった。",
  },
  {
    period: "2023年10月",
    context: "中東紛争 · 金利不安",
    drop: "−11%",
    ret: "+14%",
    note: "イスラエル・ハマス衝突と長期金利5%超が重なった。",
  },
  {
    period: "2022年9月",
    context: "インフレ · 急激な利上げ",
    drop: "−25%",
    ret: "+11%",
    note: "40年ぶりのインフレ。FRBが前例のない速度で利上げした。",
  },
];

const SIM_TIERS = [
  { label: "月3万", monthly: 3, years: 30, result: "約6,600万円", principal: "元本1,080万" },
  { label: "月5万", monthly: 5, years: 30, result: "約1.1億円", principal: "元本1,800万", highlight: true },
  { label: "月10万", monthly: 10, years: 30, result: "約2.2億円", principal: "元本3,600万" },
];

const RESEARCH_STATS = [
  { num: "30年", desc: "1994〜2024年のデータを使用" },
  { num: "90+", desc: "検証した仮説の数" },
  { num: "5本", desc: "最終的に採用したシグナル" },
  { num: "全公開", desc: "採用・棄却の理由を全てアーカイブ" },
];

export default async function HomePage() {
  // 今日のシグナル
  let verdict = "様子見";
  let reason = "データを取得中です。";
  let cls = "border-white/[0.15] bg-white/[0.06] text-slate-400";
  let dot = "bg-slate-600";
  let date = "";

  try {
    const signal = await fetchSignal();
    const plain = toPlainJapanese(signal.signalTier, signal.athDd);
    verdict = plain.verdict;
    reason = plain.reason;
    cls = plain.cls;
    dot = plain.dot;
    date = signal.date;
  } catch { /* フォールバック */ }

  // 最近の仮説（最大3件）
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
  } catch { /* フォールバック */ }

  const STATUS_LABEL: Record<string, string> = {
    open: "検証待ち", testing: "検証中", adopted: "採用", rejected: "棄却",
  };
  const STATUS_CLS: Record<string, string> = {
    open: "text-[#38bdf8]", testing: "text-amber-400", adopted: "text-[#34d399]", rejected: "text-slate-600",
  };

  return (
    <div className="min-h-screen">

      {/* ━━━ HERO ━━━ */}
      <div className="relative border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-400/[0.06] via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#38bdf8]/60">QRIP</p>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-[#e8f4ff] sm:text-4xl leading-tight">
            売る根拠も、買い足す根拠も、
            <br />
            持ち続ける根拠も。
            <span className="block mt-1 text-slate-500">30年分の統計が渡す。</span>
          </h1>

          {/* 今日の答え */}
          <div className={`mt-8 max-w-xl rounded-2xl border px-6 py-5 backdrop-blur-sm ${cls}`}>
            <div className="flex items-center gap-2 mb-2">
              <span className={`h-1.5 w-1.5 rounded-full ${dot} animate-pulse`} />
              <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-50">
                今日の答え{date ? ` — ${date}` : ""}
              </p>
            </div>
            <p className="text-2xl font-bold tracking-tight">{verdict}</p>
            <p className="mt-2 text-sm leading-6 opacity-70">{reason}</p>
            <Link
              href="/signal"
              className="mt-4 inline-block font-mono text-xs opacity-60 hover:opacity-100 transition-opacity"
            >
              根拠と詳細を見る →
            </Link>
          </div>
        </div>
      </div>

      {/* ━━━ 過去の買い場 ━━━ */}
      <div className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-1">過去の実績</p>
          <h2 className="text-lg font-semibold text-[#e8f4ff] mb-1">
            「買い場」と判定した日、その後どうなったか
          </h2>
          <p className="text-xs text-slate-600 mb-6">
            判定から2ヶ月後（約63営業日）のS&amp;P 500リターン。
          </p>

          <div className="overflow-hidden rounded-2xl border border-white/[0.12]">
            {PAST_SIGNALS.map((s, i) => (
              <div
                key={s.period}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 ${
                  i !== PAST_SIGNALS.length - 1 ? "border-b border-white/[0.08]" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="font-mono text-xs text-slate-400">{s.period}</span>
                    <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-slate-500">
                      {s.context}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{s.note}</p>
                </div>
                <div className="flex items-center gap-6 sm:shrink-0">
                  <div className="text-center">
                    <p className="font-mono text-[9px] text-slate-600 mb-0.5">高値からの下落</p>
                    <p className="font-mono text-sm font-bold text-[#f87171]">{s.drop}</p>
                  </div>
                  <div className="font-mono text-slate-700 text-lg">→</div>
                  <div className="text-center">
                    <p className="font-mono text-[9px] text-slate-600 mb-0.5">2ヶ月後</p>
                    <p className="font-mono text-sm font-bold text-[#34d399]">{s.ret}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-3 font-mono text-[9px] text-slate-700">
            過去30年（1994〜2024）の検証結果。将来のリターンを保証するものではありません。
          </p>
        </div>
      </div>

      {/* ━━━ なぜ持ち続けるか（シミュレーション） ━━━ */}
      <div className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-1">試算</p>
          <h2 className="text-lg font-semibold text-[#e8f4ff] mb-1">
            「なんとなく売らない」のではなく、数字で持ち続ける。
          </h2>
          <p className="text-xs text-slate-600 mb-6">
            毎月一定額を30年積み立てた場合のシミュレーション（年利10%想定 / S&amp;P 500の長期平均値）。
          </p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
            {SIM_TIERS.map((t) => (
              <div
                key={t.label}
                className={`rounded-2xl border px-5 py-4 ${
                  t.highlight
                    ? "border-amber-400/30 bg-amber-400/[0.06]"
                    : "border-white/[0.10] bg-white/[0.03]"
                }`}
              >
                <p className="font-mono text-xs text-slate-500 mb-1">{t.label} × {t.years}年</p>
                <p className={`font-mono text-2xl font-bold ${t.highlight ? "text-amber-300" : "text-[#e8f4ff]"}`}>
                  {t.result}
                </p>
                <p className="font-mono text-[10px] text-slate-600 mt-1">{t.principal}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-5 py-3 mb-5">
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
        </div>
      </div>

      {/* ━━━ 検証の透明性 ━━━ */}
      <div className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-1">検証書庫</p>
          <h2 className="text-lg font-semibold text-[#e8f4ff] mb-1">
            なぜこの数字を信じていいのか。根拠ごと全部公開。
          </h2>
          <p className="text-xs text-slate-600 mb-6">
            採用したシグナルだけでなく、棄却した仮説とその理由もすべてアーカイブしている。
          </p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-6">
            {RESEARCH_STATS.map((s) => (
              <div key={s.num} className="rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3 text-center">
                <p className="font-mono text-xl font-bold text-[#e8f4ff]">{s.num}</p>
                <p className="font-mono text-[9px] text-slate-600 mt-1 leading-4">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="space-y-2 mb-6">
            {[
              { label: "採用", name: "phi2 v3", stat: "30年・2ヶ月後リターンが通常の約2倍", cls: "text-[#34d399]" },
              { label: "採用", name: "RSI<25 シグナル",   stat: "TEST 勝率90%。phi2と重複率5%のほぼ独立したシグナル",     cls: "text-[#34d399]" },
              { label: "棄却", name: "金利シグナル（TNX・IRX）",  stat: "QE前後で意味が完全逆転。体制依存のため採用不可", cls: "text-[#f87171]/60" },
              { label: "棄却", name: "分割買い（2〜4回に分散投入）", stat: "全額即日投入が最良。分割するほどアルファが逃げる",  cls: "text-[#f87171]/60" },
            ].map((r) => (
              <div key={r.name} className="flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-2.5">
                <span className={`font-mono text-[9px] shrink-0 pt-0.5 ${
                  r.label === "採用" ? "text-[#34d399]" : "text-[#f87171]/60"
                }`}>{r.label}</span>
                <div>
                  <p className="font-mono text-xs text-slate-400">{r.name}</p>
                  <p className="text-[11px] text-slate-600 mt-0.5">{r.stat}</p>
                </div>
              </div>
            ))}
          </div>

          <Link
            href="/research"
            className="inline-flex items-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.07] transition-all"
          >
            全ての検証記録を読む（採用5本・棄却7本+）→
          </Link>
        </div>
      </div>

      {/* ━━━ 仮説投票 ━━━ */}
      <div className="mx-auto max-w-4xl px-6 py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-1">仮説投票</p>
        <h2 className="text-lg font-semibold text-[#e8f4ff] mb-1">
          「これも調べてほしい」を投稿する。
        </h2>
        <p className="text-xs text-slate-600 mb-6">
          投票数の多い仮説を優先的に検証する。採用・棄却の結果は書庫に公開。
        </p>

        {recentHypotheses.length > 0 ? (
          <div className="space-y-2 mb-5">
            {recentHypotheses.map((h) => (
              <div key={h.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-300 truncate">{h.title}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`font-mono text-[9px] ${STATUS_CLS[h.status] ?? "text-slate-500"}`}>
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                  <span className="font-mono text-[10px] text-slate-600">▲ {h.vote_count}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mb-5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-6 text-center">
            <p className="text-xs text-slate-600">まだ仮説がありません。最初の1件を投稿してみてください。</p>
          </div>
        )}

        <Link
          href="/hypotheses"
          className="inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-4 py-2 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/[0.08] transition-all"
        >
          仮説の一覧と投稿フォームを見る →
        </Link>
      </div>

    </div>
  );
}
