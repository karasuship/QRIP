import Link from "next/link";
import { lessons, closing } from "../data/lessons";

export const metadata = {
  title: "QRIP — 使い方と検証結果",
  description:
    "QRIPの使い方・phi2/CRS/シグナルの読み方と、30年バックテストで分かったこと。DCAを超える条件は3つだけ、すべて暴落に耐える胆力が前提だった。",
};

const SIGNALS = [
  {
    name: "phi2 v3",
    quality: "最高品質",
    color: "text-[#10b981]",
    dot: "bg-[#10b981]",
    border: "border-[#10b981]/30 bg-[#10b981]/8",
    condition: "ATH −10%以下 · 当日 −2%以下 · vol20 > 25% · CRS ≥ 2 · age非L字",
    stat: "63日後 DCA比 平均 +13.6%",
    z: "TEST Z = +8.65",
  },
  {
    name: "RSI < 25",
    quality: "補助",
    color: "text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-500/20 bg-amber-500/5",
    condition: "14日RSIが25を下抜けた瞬間",
    stat: "DCA比 +3.92%（単独では信頼度低め）",
    z: "TEST Z = +3.92",
  },
  {
    name: "HYG −8%",
    quality: "独立",
    color: "text-amber-400",
    dot: "bg-amber-500",
    border: "border-amber-500/20 bg-amber-500/5",
    condition: "クレジット市場（HYG）が60日高値から −8%以下 · ATH −5%以下",
    stat: "クレジット市場の恐怖を検知",
    z: "TEST Z = +9.42",
  },
  {
    name: "B4",
    quality: "追加",
    color: "text-blue-400",
    dot: "bg-blue-500",
    border: "border-blue-500/20 bg-blue-500/5",
    condition: "phi2発動から7営業日後 · 今日もATH −10%以下",
    stat: "63日後 DCA比 平均 +6.57%",
    z: "TEST Z = +8.29",
  },
];

const STEPS = [
  {
    n: "01",
    title: "/signal を開く",
    body: "「今日の結論」が一行で書いてある。技術的な詳細を読まなくても、何をすればいいかがわかるように設計している。",
  },
  {
    n: "02",
    title: "CRSスコアを読む",
    body: "0〜6の数字。今の市場の「恐怖の深さ」の指標。≥ 2 でシグナル有効、≥ 4 で高品質ゾーン、5〜6 なら投入量を2倍にする根拠がある。",
  },
  {
    n: "03",
    title: "シグナルが発動したら",
    body: "ドライパウダー（待機資金）を使うタイミングの統計的根拠が揃った日。「必ず上がる」ではない。「過去30年の平均でDCA比+13.6%だった」という事実を渡している。",
  },
  {
    n: "04",
    title: "通知を設定する",
    body: "シグナルページの「シグナル通知を受け取る」ボタンでWeb Push通知をオンにできる。毎日チェックしなくてもシグナル発動時に知れる。",
  },
];

export default function Learn() {
  return (
    <div className="min-h-screen bg-[#050508] text-[#e2e8f0]">
      <main className="mx-auto max-w-2xl px-5 py-12">
        <Link
          href="/"
          className="font-mono text-xs text-[#64748b] hover:text-[#94a3b8] transition-colors"
        >
          ← ホームにもどる
        </Link>

        {/* ── ヘッダ ─────────────────────────────── */}
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#2e2e48]">
            Learn / 使い方と検証結果
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e2e8f0]">
            QRIPの使い方
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#64748b]">
            このツールは相場を予測しない。「過去、同じ条件の局面ではどうなったか」という事実を渡すだけ。
            数字の読み方と、その根拠となった検証を説明する。
          </p>
        </div>

        {/* ── 使い方 4ステップ ─────────────────── */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#2e2e48]">
            使い方
          </p>
          <div className="mt-3 space-y-2">
            {STEPS.map((s) => (
              <div
                key={s.n}
                className="flex gap-4 rounded-xl border border-[#1e1e32] bg-[#0c0c15] p-4"
              >
                <span className="font-mono text-xl font-bold text-[#1e1e32] shrink-0 w-7 pt-0.5">
                  {s.n}
                </span>
                <div>
                  <p className="text-sm font-semibold text-[#e2e8f0]">{s.title}</p>
                  <p className="mt-1 text-xs leading-6 text-[#64748b]">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── シグナルの読み方 ─────────────────── */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#2e2e48]">
            シグナルの読み方
          </p>
          <p className="mt-1 mb-3 text-xs text-[#64748b]">
            4体制が独立して動く。いずれか発動で OR 条件。数値は30年バックテスト由来。
          </p>
          <div className="space-y-2">
            {SIGNALS.map((s) => (
              <div
                key={s.name}
                className={`rounded-xl border p-4 ${s.border}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`font-mono text-sm font-bold ${s.color}`}>{s.name}</span>
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#2e2e48] ml-1">
                    {s.quality}
                  </span>
                </div>
                <p className="text-xs text-[#64748b] mb-1">{s.condition}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className={`font-mono text-xs font-semibold ${s.color}`}>{s.stat}</span>
                  <span className="font-mono text-[10px] text-[#2e2e48]">{s.z}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── CRSの読み方 ─────────────────────── */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#2e2e48]">
            CRS（Crisis Recovery Score）の読み方
          </p>
          <p className="mt-2 mb-3 text-xs leading-6 text-[#64748b]">
            VIX・HYG・DXY・ATH経過日数・RSPの5要素をバイナリで合計した0〜6のスコア。
            「今の市場がどれだけ恐怖に覆われているか」の深さを示す。未来予測ではない。
          </p>
          <div className="overflow-hidden rounded-xl border border-[#1e1e32]">
            <table className="w-full text-sm">
              <thead className="border-b border-[#1e1e32] bg-[#090910]">
                <tr>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-[#2e2e48]">スコア</th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-[#2e2e48]">状態</th>
                  <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-[#2e2e48]">対応</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { score: "0〜1", state: "通常", note: "シグナル無効", color: "text-[#2e2e48]" },
                  { score: "2〜3", state: "警戒", note: "phi2シグナル有効", color: "text-amber-400" },
                  { score: "4",   state: "高品質", note: "統計精度が上がる", color: "text-amber-400" },
                  { score: "5〜6", state: "最高品質", note: "投入量2倍を検討する根拠", color: "text-[#ef4444]" },
                ].map((r) => (
                  <tr key={r.score} className="border-t border-[#16162a]">
                    <td className={`px-4 py-2.5 font-mono text-sm font-bold ${r.color}`}>{r.score}</td>
                    <td className="px-4 py-2.5 text-sm text-[#94a3b8]">{r.state}</td>
                    <td className="px-4 py-2.5 text-xs text-[#64748b]">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── 区切り ───────────────────────────── */}
        <div className="mt-12 border-t border-[#1e1e32] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-[#2e2e48]">
            なぜこのアプローチか — 検証で分かったこと
          </p>
          <p className="mt-2 text-sm leading-7 text-[#64748b]">
            「もっと安く買えたはず」「今は待つべきだ」——その直感を、30年分のデータで全部検証した。
            結論は、投資の常識をなぞるようでいて、行動を変えるものだった。
          </p>
        </div>

        {/* ── 検証レッスン ─────────────────────── */}
        <div className="mt-8 space-y-10">
          {lessons.map((l) => (
            <section key={l.id}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#10b981]">
                {l.tag}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[#e2e8f0]">{l.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#64748b]">{l.lead}</p>

              {l.rows && (
                <div className="mt-4 overflow-hidden rounded-xl border border-[#1e1e32]">
                  <table className="w-full text-sm">
                    <tbody>
                      {l.rows.map((r) => (
                        <tr
                          key={r.label}
                          className="border-t border-[#16162a] first:border-t-0"
                        >
                          <td className="px-4 py-2.5 text-[#94a3b8]">{r.label}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#10b981] tabular-nums">
                            {r.value}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] text-[#2e2e48]">
                            {r.note ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {l.body.map((p, i) => (
                <p key={i} className="mt-4 text-sm leading-6 text-[#64748b]">
                  {p}
                </p>
              ))}

              <div className="mt-4 rounded-xl border border-[#10b981]/20 bg-[#10b981]/8 px-4 py-3">
                <p className="text-sm font-medium leading-6 text-[#10b981]">{l.takeaway}</p>
              </div>
            </section>
          ))}
        </div>

        {/* ── クロージング ─────────────────────── */}
        <div className="mt-12 border-t border-[#1e1e32] pt-8">
          <p className="text-base font-medium leading-7 text-[#e2e8f0]">{closing}</p>
          <Link
            href="/signal"
            className="mt-5 inline-block rounded border border-[#10b981]/40 bg-[#10b981]/10 px-5 py-2.5 font-mono text-xs text-[#10b981] hover:bg-[#10b981]/20 transition-colors tracking-wide"
          >
            → 今日のシグナルを見る
          </Link>
        </div>

        <p className="mt-8 font-mono text-[10px] leading-6 text-[#2e2e48]">
          数値はS&P500等の過去データに対する自前バックテスト（engine/archive）由来。
          過去の分布であり、将来を保証しません。これは投資助言ではなく事実の提示です。
        </p>
      </main>
    </div>
  );
}
