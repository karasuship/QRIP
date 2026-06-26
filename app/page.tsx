import Link from "next/link";
import { fetchSignal } from "@/lib/signal";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "QRIP — 今日、買うべきか",
  description:
    "30年分の相場データをもとに「今日、追加で買うべきか」を毎日判定する。予測ではなく統計的根拠の提示。",
};

export const revalidate = 900;

// ジャーゴンなしで今日の状態を説明する
function toPlainJapanese(
  signalTier: string,
  athDd: number
): { verdict: string; reason: string; cls: string } {
  const drop = Math.abs(athDd * 100).toFixed(1);

  switch (signalTier) {
    case "DOUBLE":
      return {
        verdict: "強い買い場",
        reason:
          "30年間で8回しか見たことのない水準の急落。コロナショック・リーマンショックと同じ条件が揃っている。",
        cls: "border-violet-400/40 bg-violet-400/[0.07] text-violet-300",
      };
    case "PHI2":
      return {
        verdict: "買い場",
        reason: `高値から ${drop}% 下落。過去30年の同じ条件、2ヶ月後の平均リターンは通常の約2倍だった。`,
        cls: "border-[#34d399]/40 bg-[#34d399]/[0.07] text-[#34d399]",
      };
    case "NEAR":
      return {
        verdict: "条件待ち",
        reason: `高値から ${drop}% 下落。あと少しで「買い場」の条件が揃う。定期積立を続けながら待つ局面。`,
        cls: "border-amber-400/25 bg-amber-400/[0.05] text-amber-400",
      };
    case "RSI25":
      return {
        verdict: "弱いシグナル",
        reason:
          "短期的に売られすぎているが、単独では根拠として薄い。定期積立の継続が無難。",
        cls: "border-white/[0.20] bg-white/[0.06] text-slate-300",
      };
    default:
      return {
        verdict: "様子見",
        reason: `高値からまだ ${drop}% しか下がっていない。焦って動くより、毎月の定期積立を続けるほうが合理的。`,
        cls: "border-white/[0.15] bg-white/[0.06] text-slate-400",
      };
  }
}

// 実際にシグナルが発動した過去の局面（実績値）
const PAST_SIGNALS = [
  {
    period: "2020年3月",
    context: "コロナショック",
    drop: "−34%",
    ret: "+40%",
    note: "1ヶ月で株価が3分の2になった底で発動した。",
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
    context: "インフレ · 利上げ",
    drop: "−25%",
    ret: "+11%",
    note: "40年ぶりのインフレ。FRBが前例のない速度で利上げした。",
  },
];

export default async function HomePage() {
  let verdict = "様子見";
  let reason = "データを取得中です。";
  let cls = "border-white/[0.15] bg-white/[0.06] text-slate-400";
  let date = "";

  try {
    const signal = await fetchSignal();
    const plain = toPlainJapanese(signal.signalTier, signal.athDd);
    verdict = plain.verdict;
    reason = plain.reason;
    cls = plain.cls;
    date = signal.date;
  } catch {
    // データ取得失敗時はフォールバック表示
  }

  return (
    <div className="min-h-screen">
      {/* ── ヒーロー ── */}
      <div className="relative border-b border-white/[0.08]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-400/[0.05] via-transparent to-transparent" />
        <main className="relative mx-auto max-w-4xl px-6 py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#38bdf8]/60">
            QRIP
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#e8f4ff] sm:text-4xl leading-tight">
            今日、追加で買うべきか。
            <span className="block text-slate-500">30年分の統計が答える。</span>
          </h1>

          {/* 今日の答え */}
          <div className={`mt-8 rounded-2xl border px-6 py-5 backdrop-blur-sm ${cls}`}>
            <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-50 mb-2">
              今日の答え{date ? ` — ${date}` : ""}
            </p>
            <p className="text-2xl font-bold tracking-tight">{verdict}</p>
            <p className="mt-2 text-sm leading-6 opacity-70">{reason}</p>
            <Link
              href="/signal"
              className="mt-4 inline-block font-mono text-xs opacity-60 hover:opacity-100 transition-opacity"
            >
              根拠と詳細を見る →
            </Link>
          </div>
        </main>
      </div>

      {/* ── 過去の実績 ── */}
      <div className="border-b border-white/[0.08]">
        <div className="mx-auto max-w-4xl px-6 py-14">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-1">
            過去の実績
          </p>
          <h2 className="text-lg font-semibold text-[#e8f4ff] mb-1">
            「買い場」と判定した日、その後どうなったか
          </h2>
          <p className="text-xs text-slate-600 mb-6">
            判定から2ヶ月後（約63営業日）のS&amp;P 500リターン。
          </p>

          <div className="overflow-hidden rounded-2xl border border-white/[0.12] backdrop-blur-sm">
            {PAST_SIGNALS.map((s, i) => (
              <div
                key={s.period}
                className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 ${
                  i !== PAST_SIGNALS.length - 1 ? "border-b border-white/[0.08]" : ""
                }`}
              >
                {/* 日付・コンテキスト */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-0.5">
                    <span className="font-mono text-xs text-slate-400">{s.period}</span>
                    <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 font-mono text-[9px] text-slate-500">
                      {s.context}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600">{s.note}</p>
                </div>

                {/* 数値 */}
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

      {/* ── 3つの機能 ── */}
      <div className="mx-auto max-w-4xl px-6 py-14">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-600 mb-6">
          このサイトでできること
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            {
              href: "/signal",
              title: "今日、買うべきかを確認する",
              desc: "毎日更新。「買い場」かどうかを一言で判定し、根拠の数字を添えて表示する。通知設定もできる。",
              cta: "シグナルを見る",
              color: "text-[#38bdf8]",
            },
            {
              href: "/simulate",
              title: "30年積み立てたらいくらになるか試算する",
              desc: "月5万円を30年積み立てると約1.1億円。銘柄・金額・期間・ボーナスを変えて試算できる。",
              cta: "試算を始める",
              color: "text-amber-400",
            },
            {
              href: "/news",
              title: "世界のニュースを3行で読む",
              desc: "相場に影響しそうな世界ニュースを毎朝AIが要約。長い記事を読まなくても「今日の空気感」がわかる。",
              cta: "ニュースを読む",
              color: "text-[#a78bfa]",
            },
          ].map((f) => (
            <Link
              key={f.href}
              href={f.href}
              className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.18] transition-all"
            >
              <p className="text-sm font-semibold leading-snug text-[#e8f4ff] group-hover:text-white transition-colors mb-2">
                {f.title}
              </p>
              <p className="text-[11px] leading-5 text-slate-500 mb-4">{f.desc}</p>
              <p className={`font-mono text-[10px] ${f.color}`}>{f.cta} →</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
