"use client";

import { useState } from "react";
import Link from "next/link";
import behavior from "./data/behavior.json";

const DEPTHS = ["5〜10%", "10〜20%", "20〜35%", "35%以上"];
const SPEEDS: { key: string; label: string }[] = [
  { key: "fast", label: "急落（1ヶ月で-10%以上）" },
  { key: "gradual", label: "じわじわ" },
];

function pct(n: number | null) {
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n}%`;
}

export default function Home() {
  const [depth, setDepth] = useState("10〜20%");
  const [speed, setSpeed] = useState("fast");
  const cell = behavior.cells.find((c) => c.depth === depth && c.speed === speed);
  const hasData = cell && cell.horizons.some((h) => h.median !== null);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div className="relative border-b border-white/[0.14]">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-sky-400/[0.07] via-sky-400/[0.02] to-transparent" />
        <main className="relative mx-auto max-w-4xl px-6 py-20">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#38bdf8]/70">
            市場観測 / QRIP
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[#e8f4ff] sm:text-4xl">
            いま、売るべきか？
            <span className="block text-slate-400">過去はこうだった。</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">
            相場が下げると最初の判断を忘れて投げ売りしたくなる。でも「どこまで下がる」は誰にも当てられない。
            このツールは予測しない。
            <span className="text-slate-400">「過去、同じような局面はどうなったか」という事実だけ</span>を見せる。
          </p>
          <div className="mt-6 flex gap-3">
            <Link
              href="/signal"
              className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-5 py-2.5 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-colors tracking-wide backdrop-blur-sm"
            >
              → リアルタイム シグナル
            </Link>
            <Link
              href="/learn"
              className="rounded-xl border border-white/[0.18] bg-white/[0.07] px-5 py-2.5 font-mono text-xs text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition-colors tracking-wide backdrop-blur-sm"
            >
              検証データを読む
            </Link>
          </div>
        </main>
      </div>

      {/* ===== このサイトでできること ===== */}
      <div className="border-b border-white/[0.08] bg-white/[0.02]">
        <div className="mx-auto max-w-4xl px-6 py-12">
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-slate-600">What you can do</p>
          <h2 className="mt-1 text-lg font-semibold text-[#e8f4ff]">
            脳死積立を、根拠のある積立に変える
          </h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">
            毎月同額を投信に投げているだけでは得られない、数値で証明された3つの改善がここにある。
          </p>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {/* ① いつ買うか */}
            <Link href="/signal" className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.18] transition-all">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#38bdf8]/70">① いつ買うか</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#e8f4ff] group-hover:text-white transition-colors">
                「暴落の翌日は買い場か？」を30年分のデータで判定する
              </p>
              <div className="mt-3 rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.07] px-3 py-2">
                <p className="font-mono text-xs font-bold text-[#34d399]">+14.5%</p>
                <p className="font-mono text-[9px] text-slate-500">phi2シグナル発動の63日後平均リターン（TEST）</p>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                特定の条件が揃った暴落日だけに絞ると、ランダム購入より統計的に優位だと分かった。そのシグナルが今日発動しているかをリアルタイムで見られる。
              </p>
              <p className="mt-3 font-mono text-[10px] text-[#38bdf8]">シグナルを確認 →</p>
            </Link>

            {/* ② いくら買うか */}
            <Link href="/simulate" className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.18] transition-all">
              <p className="font-mono text-[9px] uppercase tracking-widest text-amber-400/70">② 何に・いくら買うか</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#e8f4ff] group-hover:text-white transition-colors">
                年利0.5%の改善で、30年後の資産はいくら変わるか知っているか
              </p>
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.07] px-3 py-2">
                <p className="font-mono text-xs font-bold text-amber-400">+1,200万円</p>
                <p className="font-mono text-[9px] text-slate-500">月5万×30年、年利10.4%→10.9%の差額</p>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                月5万を30年積み立てると約1.1億円。ここにphi2アルファ（+2.3%/年）が乗ると約1.2億円超になる。NISAの活用・ボーナス投下のタイミングも試算できる。
              </p>
              <p className="mt-3 font-mono text-[10px] text-amber-400">30年を試算する →</p>
            </Link>

            {/* ③ 売らずに持てるか */}
            <Link href="/journal" className="group rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5 hover:bg-white/[0.06] hover:border-white/[0.18] transition-all">
              <p className="font-mono text-[9px] uppercase tracking-widest text-[#a78bfa]/70">③ 暴落中に売らない</p>
              <p className="mt-2 text-sm font-semibold leading-snug text-[#e8f4ff] group-hover:text-white transition-colors">
                「なぜ買ったか」を記録すれば、暴落中に読み返して冷静でいられる
              </p>
              <div className="mt-3 rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/[0.07] px-3 py-2">
                <p className="font-mono text-xs font-bold text-[#a78bfa]">HOLD が最良</p>
                <p className="font-mono text-[9px] text-slate-500">売り戦略との30年差は年5,000円未満（Round 43）</p>
              </div>
              <p className="mt-3 text-[11px] leading-5 text-slate-500">
                投資の最大の敵は暴落時の感情。「CRS=5、phi2発動、だから買った」と記録しておくと、暴落中に読み返して手を止められる。
              </p>
              <p className="mt-3 font-mono text-[10px] text-[#a78bfa]">投資日誌を記録する →</p>
            </Link>
          </div>

          {/* サブ機能 */}
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { href: "/news",        label: "ニュース",   desc: "世界ニュースをAIが3行に凝縮。相場への影響を毎朝判定",          color: "text-slate-400" },
              { href: "/research",    label: "検証書庫",   desc: "Round 01〜43の全バックテスト結果を公開。採用・不採用の根拠",    color: "text-slate-400" },
              { href: "/hypotheses",  label: "仮説投票",   desc: "「これも検証してほしい」を投稿。票数で研究キューが決まる",      color: "text-slate-400" },
              { href: "/board",       label: "掲示板",     desc: "銘柄・考察・サイトへの質問を自由に投稿",                        color: "text-slate-400" },
            ].map((f) => (
              <Link
                key={f.href}
                href={f.href}
                className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 hover:bg-white/[0.05] hover:border-white/[0.14] transition-all"
              >
                <p className={`font-mono text-[10px] font-semibold ${f.color}`}>{f.label} →</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-600">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl px-6 py-10">
        {/* 過去分布インタラクティブ */}
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-4">
          過去の相場分布 — いま「売るべきか」の根拠を確認する
        </p>

        {/* 下落幅セレクタ */}
        <section>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Step 1 — 高値からの下落幅
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {DEPTHS.map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`rounded-xl border px-4 py-1.5 font-mono text-xs transition-all backdrop-blur-sm ${
                  depth === d
                    ? "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]"
                    : "border-white/[0.18] bg-white/[0.06] text-slate-400 hover:border-white/[0.14] hover:text-slate-300"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-widest text-slate-400">
            Step 2 — 下がり方
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSpeed(s.key)}
                className={`rounded-xl border px-4 py-1.5 font-mono text-xs transition-all backdrop-blur-sm ${
                  speed === s.key
                    ? "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]"
                    : "border-white/[0.18] bg-white/[0.06] text-slate-400 hover:border-white/[0.14] hover:text-slate-300"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        {/* 結果カード */}
        <section className="mt-6 rounded-2xl border border-white/[0.18] bg-white/[0.09] p-6 backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            {behavior.source} — 過去の分布
          </p>
          <p className="mt-1 text-sm text-slate-400">
            高値から<span className="text-slate-300 font-medium">{depth}</span>・
            <span className="text-slate-300 font-medium">{speed === "fast" ? "急落" : "じわじわ"}</span>
            の局面から——
          </p>

          {hasData ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                {cell!.horizons.map((h) => (
                  <div key={h.h} className="rounded-2xl border border-white/[0.14] bg-white/[0.07] p-4 text-center backdrop-blur-sm">
                    <p className="font-mono text-[9px] uppercase tracking-widest text-slate-400">{h.h}後</p>
                    <p className={`mt-1.5 font-mono text-2xl font-bold ${
                      h.median !== null && h.median > 0 ? "text-[#34d399]" : "text-[#f87171]"
                    }`}>
                      {pct(h.median)}
                    </p>
                    <p className="text-[10px] text-white/35">中央値</p>
                    <p className="mt-1.5 font-mono text-xs text-slate-400">勝率 {h.win}%</p>
                    <p className="font-mono text-[10px] text-[#f87171]/60">最悪 {pct(h.worst)}</p>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-400">
                最悪{" "}
                <span className="font-mono text-[#f87171]">{pct(cell!.horizons[0].worst)}</span>
                {" "}まで落ちた事例もある。でも 1 年持てば中央値{" "}
                <span className="font-mono text-[#34d399]">{pct(cell!.horizons[1].median)}</span>
                （勝率{cell!.horizons[1].win}%）、3 年で{" "}
                <span className="font-mono text-[#34d399]">{pct(cell!.horizons[2].median)}</span>
                （勝率{cell!.horizons[2].win}%）だった。
              </p>
              <p className="mt-2 font-mono text-[10px] text-white/35">
                n = 約{cell!.n}（延べ該当局面数）
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              この組み合わせは過去の該当事例が少なく、信頼できる分布を出せません。
            </p>
          )}
        </section>

        {/* 下落確率表 */}
        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
            大きな下落はどれくらい来るか
          </p>
          <p className="mt-1 text-xs text-slate-600">
            「待っていれば安く買える」は幻想。大きな下落は滅多に来ない。
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
            <table className="w-full text-center text-xs">
              <thead className="border-b border-white/[0.14] bg-white/[0.06]">
                <tr>
                  <th className="py-2.5 font-mono text-[9px] uppercase tracking-widest text-slate-400">下落幅</th>
                  {behavior.dropProb[0].within.map((w) => (
                    <th key={w.days} className="py-2.5 font-mono text-[9px] uppercase tracking-widest text-slate-400">
                      {w.days}以内
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {behavior.dropProb.map((row) => (
                  <tr key={row.x} className="border-t border-white/[0.10]">
                    <td className="py-2.5 font-mono text-xs text-slate-400">{row.x}下落</td>
                    {row.within.map((w) => (
                      <td key={w.days} className="py-2.5 font-mono text-xs text-slate-400">
                        {w.p}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Learn link */}
        <section className="mt-10 border-t border-white/[0.05] pt-6">
          <p className="text-xs text-slate-600">なぜ「予測しない」のか？</p>
          <p className="mt-1 text-[11px] text-slate-700">
            DCA を超える方法は 3 つだけ——を 30 年分のデータで検証しました。
          </p>
          <Link
            href="/learn"
            className="mt-3 inline-block font-mono text-xs text-[#38bdf8] hover:text-sky-300 transition-colors"
          >
            タイミングという幻想 — 検証で分かった事実 →
          </Link>
        </section>

        <p className="mt-8 font-mono text-[10px] leading-5 text-slate-400">
          {behavior.note} これは投資助言ではなく、過去データの分布提示です。
        </p>
      </main>
    </div>
  );
}
