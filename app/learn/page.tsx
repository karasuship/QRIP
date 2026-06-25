import Link from "next/link";
import { lessons, closing } from "../data/lessons";
import simRaw from "@/app/data/sim-result.json";
import type { SimMonthly, Phi2Signal } from "@/app/components/charts/SimulationChart";
import SimulationChart from "@/app/components/charts/SimulationChartClient";

export const metadata = {
  title: "QRIP — 使い方と検証結果",
  description:
    "QRIPの使い方・phi2/CRS/シグナルの読み方と、30年バックテストで分かったこと。DCAを超える条件は3つだけ、すべて暴落に耐える胆力が前提だった。",
};

const SIGNALS = [
  {
    name: "phi2 v3", quality: "最高品質",
    color: "text-[#34d399]", dot: "bg-[#34d399]", border: "border-[#34d399]/30 bg-[#34d399]/[0.07]",
    condition: "ATH −10%以下 · 当日 −2%以下 · vol20 > 25% · CRS ≥ 2 · age非L字",
    stat: "63日後 DCA比 平均 +13.6%", z: "TEST Z = +8.65",
  },
  {
    name: "RSI < 25", quality: "補助",
    color: "text-amber-400", dot: "bg-amber-400", border: "border-amber-400/20 bg-amber-400/[0.05]",
    condition: "14日RSIが25を下抜けた瞬間",
    stat: "DCA比 +3.92%（単独では信頼度低め）", z: "TEST Z = +3.92",
  },
  {
    name: "HYG −8%", quality: "独立",
    color: "text-amber-400", dot: "bg-amber-400", border: "border-amber-400/20 bg-amber-400/[0.05]",
    condition: "クレジット市場（HYG）が60日高値から −8%以下 · ATH −5%以下",
    stat: "クレジット市場の恐怖を検知", z: "TEST Z = +9.42",
  },
  {
    name: "B4", quality: "追加",
    color: "text-sky-400", dot: "bg-sky-400", border: "border-sky-400/20 bg-sky-400/[0.05]",
    condition: "phi2発動から7営業日後 · 今日もATH −10%以下",
    stat: "63日後 DCA比 平均 +6.57%", z: "TEST Z = +8.29",
  },
];

const STEPS = [
  { n: "01", title: "/signal を開く",       body: "「今日の結論」が一行で書いてある。技術的な詳細を読まなくても、何をすればいいかがわかるように設計している。" },
  { n: "02", title: "CRSスコアを読む",       body: "0〜6の数字。今の市場の「恐怖の深さ」の指標。≥ 2 でシグナル有効、≥ 4 で高品質ゾーン、5〜6 なら投入量を2倍にする根拠がある。" },
  { n: "03", title: "シグナルが発動したら",   body: "ドライパウダー（待機資金）を使うタイミングの統計的根拠が揃った日。「必ず上がる」ではない。「過去30年の平均でDCA比+13.6%だった」という事実を渡している。" },
  { n: "04", title: "通知を設定する",         body: "シグナルページの「シグナル通知を受け取る」ボタンでWeb Push通知をオンにできる。毎日チェックしなくてもシグナル発動時に知れる。" },
];

// シミュレーションデータは scripts/compute-sim.mjs で生成した JSON をそのまま使う
// CSV ファイルや外部 API に依存しないので Vercel で確実に動く
const simResult = {
  monthly:         simRaw.monthly  as SimMonthly[],
  signals:         simRaw.signals  as Phi2Signal[],
  totalSignals:    simRaw.totalSignals,
  signalsPerYear:  simRaw.signalsPerYear,
  dcaFinal:        simRaw.dcaFinal,
  phi2Final:       simRaw.phi2Final,
  alpha:           simRaw.alpha,
};

export default function Learn() {

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        {/* ヘッダ */}
        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Learn / 使い方と検証結果</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">QRIPの使い方</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            このツールは相場を予測しない。「過去、同じ条件の局面ではどうなったか」という事実を渡すだけ。
            数字の読み方と、その根拠となった検証を説明する。
          </p>
        </div>

        {/* シミュレーションチャート */}
        {simResult && simResult.monthly.length > 0 && (
          <section className="mt-8">
            <SimulationChart
              monthly={simResult.monthly}
              signals={simResult.signals}
              dcaFinal={simResult.dcaFinal}
              phi2Final={simResult.phi2Final}
              alpha={simResult.alpha}
            />
            <div className="mt-2 flex flex-wrap gap-4 font-mono text-[10px] text-slate-600">
              <span>発動回数（2008〜）: <span className="text-slate-400">{simResult.totalSignals}回</span></span>
              <span>年平均: <span className="text-slate-400">{simResult.signalsPerYear}回</span></span>
            </div>
          </section>
        )}

        {/* 使い方 4ステップ */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">使い方</p>
          <div className="mt-3 space-y-2">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-4 rounded-2xl border border-white/[0.18] bg-white/[0.07] p-4 backdrop-blur-sm">
                <span className="w-7 shrink-0 pt-0.5 font-mono text-xl font-bold text-white/10">{s.n}</span>
                <div>
                  <p className="text-sm font-semibold text-[#e8f4ff]">{s.title}</p>
                  <p className="mt-1 text-xs leading-6 text-slate-400">{s.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* シグナルの読み方 */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">シグナルの読み方</p>
          <p className="mt-1 mb-3 text-xs text-slate-400">4体制が独立して動く。いずれか発動で OR 条件。数値は30年バックテスト由来。</p>
          <div className="space-y-2">
            {SIGNALS.map((s) => (
              <div key={s.name} className={`rounded-2xl border p-4 backdrop-blur-sm ${s.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${s.dot}`} />
                  <span className={`font-mono text-sm font-bold ${s.color}`}>{s.name}</span>
                  <span className="ml-1 font-mono text-[10px] uppercase tracking-widest text-slate-400">{s.quality}</span>
                </div>
                <p className="text-xs text-slate-400 mb-2">{s.condition}</p>
                <div className="flex items-center gap-3">
                  <span className={`font-mono text-xs font-semibold ${s.color}`}>{s.stat}</span>
                  <span className="font-mono text-[10px] text-slate-400">{s.z}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CRS対応表 */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">CRS（Crisis Recovery Score）の読み方</p>
          <p className="mt-2 mb-3 text-xs leading-6 text-slate-400">
            VIX・HYG・DXY・ATH経過日数・RSPの5要素をバイナリで合計した0〜6のスコア。
            「今の市場がどれだけ恐怖に覆われているか」の深さを示す。未来予測ではない。
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                <tr>
                  {["スコア","状態","対応"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { score: "0〜1", state: "通常",    note: "シグナル無効",        color: "text-slate-400" },
                  { score: "2〜3", state: "警戒",    note: "phi2シグナル有効",    color: "text-amber-400" },
                  { score: "4",   state: "高品質",   note: "統計精度が上がる",    color: "text-amber-400" },
                  { score: "5〜6", state: "最高品質", note: "投入量2倍を検討する根拠", color: "text-[#f87171]" },
                ].map((r) => (
                  <tr key={r.score} className="border-t border-white/[0.09]">
                    <td className={`px-4 py-2.5 font-mono text-sm font-bold ${r.color}`}>{r.score}</td>
                    <td className="px-4 py-2.5 text-sm text-slate-400">{r.state}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ⑤ EFA 国際分散 */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">EFA 先進国インデックスへの応用（Round 42）</p>
          <p className="mt-2 mb-3 text-xs leading-6 text-slate-400">
            phi2 v3 の条件（ATH乖離・vol・CRS）はSP500専用ではない。
            CRSは米国指標だが、グローバルな金融危機は米国主導のため、世界市場にも機能する。
          </p>
          <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                <tr>
                  {["インデックス","TEST Z","63日後","推奨"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "SP500（VOO）",      z: "+8.65", ret: "+14.5%", rec: "◎", color: "text-[#34d399]" },
                  { name: "EFA 先進国（VEA）", z: "+8.08", ret: "+15.6%", rec: "○", color: "text-[#34d399]" },
                  { name: "EEM 新興国（VWO）", z: "+6.74", ret: "+12.1%", rec: "△", color: "text-amber-400" },
                  { name: "QQQ NASDAQ100",      z: "+4.16", ret: "+9.4%",  rec: "△", color: "text-slate-400" },
                ].map(r => (
                  <tr key={r.name} className="border-t border-white/[0.09]">
                    <td className="px-4 py-2.5 text-sm text-slate-300">{r.name}</td>
                    <td className={`px-4 py-2.5 font-mono text-sm font-semibold ${r.color}`}>{r.z}</td>
                    <td className={`px-4 py-2.5 font-mono text-sm ${r.color}`}>{r.ret}</td>
                    <td className={`px-4 py-2.5 font-mono text-sm ${r.color}`}>{r.rec}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-4 py-3 backdrop-blur-sm">
            <p className="text-sm font-medium leading-6 text-[#38bdf8]">
              phi2発動時にSP500+EFA同時買いは統計的に支持される。QQQは過発動（TEST n=58）で希釈されるため非推奨。
            </p>
          </div>
        </section>

        {/* ⑥ 63日アルファ集中の構造 */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">なぜ売らなくていいのか（Round 39 · 43）</p>
          <p className="mt-2 text-xs leading-6 text-slate-400">
            phi2のアルファ（超過リターン）は<strong className="text-slate-300">最初の63日に集中する</strong>。
            63日後以降は「普通の市場リターン（年率約+7.8%）」に戻る。
          </p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                <tr>
                  {["保有期間","年率換算リターン","出口戦略","TEST Z"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { period: "63日（固定）",      rate: "+72.0%/年", strategy: "固定63日保有", z: "+8.41", highlight: true },
                  { period: "126日（固定）",     rate: "+48.2%/年", strategy: "—",              z: "+13.79", highlight: false },
                  { period: "252日（固定）",     rate: "+36.6%/年", strategy: "—",              z: "+25.01", highlight: false },
                  { period: "CRS=0復帰",         rate: "+43.3%/年", strategy: "恐怖消滅後売り", z: "+10.46", highlight: false },
                  { period: "RSI>55復帰（10日）",rate: "+48.8%/年", strategy: "素早い出口",     z: "−1.12 ✗", highlight: false },
                ].map(r => (
                  <tr key={r.period} className={`border-t border-white/[0.09] ${r.highlight ? "bg-[#34d399]/[0.04]" : ""}`}>
                    <td className={`px-4 py-2.5 font-mono text-xs ${r.highlight ? "text-[#34d399]" : "text-slate-400"}`}>{r.period}</td>
                    <td className={`px-4 py-2.5 font-mono text-xs font-semibold ${r.highlight ? "text-[#34d399]" : "text-slate-300"}`}>{r.rate}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.strategy}</td>
                    <td className={`px-4 py-2.5 font-mono text-xs ${r.z.includes("✗") ? "text-[#f87171]" : r.highlight ? "text-[#34d399]" : "text-slate-400"}`}>{r.z}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 rounded-2xl border border-[#34d399]/20 bg-[#34d399]/[0.06] px-4 py-3 backdrop-blur-sm">
            <p className="text-sm font-medium leading-6 text-[#34d399]">
              売らずにHOLDするのが最良。30年シミュレーションで売り戦略との差は14〜16万（年5,000円未満）。
              税金と手数料を考えると明確にHOLD優位。
            </p>
          </div>
        </section>

        {/* ⑦ 機能しなかった仮説 */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">試して捨てた仮説</p>
          <p className="mt-2 mb-3 text-xs leading-6 text-slate-400">
            検証で「機能しない」と判明したもの。直感的に正しそうでも、データでは裏付けられなかった。
          </p>
          <div className="space-y-2">
            {[
              {
                name: "RSI<25 単体",
                why: "TRAIN Z=+0.06（ランダムと同等）。phi2条件と重なる局面でのみ意味を持つ。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
              {
                name: "分割買い（複数回に分けて購入）",
                why: "全額即買いに負ける。phi2シグナルは「今日が統計的根拠のある日」であり、分割する意味がない。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
              {
                name: "ATHティア別加重（深いほど多く買う）",
                why: "TRAIN/TESTで深度分布が逆転。GFC（-30%超）はTEST期間でゼロ。過去データへの過学習リスク。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
              {
                name: "金利シグナル（TNX・IRX）",
                why: "QE前後で解釈が逆転。利上げ局面では「上がるから買い」、利下げ局面では「景気悪化の証拠」と真逆になる。体制依存で不採用。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
              {
                name: "CAPE割安フィルタ（高CAPEは買わない）",
                why: "高CAPE（30〜35）環境でもTEST Z=+6.72。QE市場では割高でも回復が速い。CAPEは長期バリュエーションの参考にはなるが、シグナルフィルタには機能しない。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
              {
                name: "RSI>55での素早い出口（平均10日）",
                why: "TEST Z=−1.12（負の方向）。短期バウンスへの反応に過ぎない。統計的に不安定。",
                color: "border-white/[0.12] bg-white/[0.06]",
              },
            ].map(h => (
              <div key={h.name} className={`rounded-2xl border px-4 py-3 backdrop-blur-sm ${h.color}`}>
                <p className="text-sm font-medium text-slate-500 line-through">{h.name}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{h.why}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ⑧ regime-specific 発見（R45） */}
        <section className="mt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">体制別の検証結果（Round 45 — 新発見）</p>
          <p className="mt-2 mb-3 text-xs leading-6 text-slate-400">
            30年を金融政策体制で3分割して phi2 の有効性を再検証。
            「局所的に成立するルールを構造的に説明できれば未来に応用可能」という視点から分析した。
          </p>

          {/* 体制定義 */}
          <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm mb-3">
            <table className="w-full text-sm">
              <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                <tr>
                  {["体制","期間","特徴"].map(h => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-widest text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { regime: "A: 従来型", period: "1996〜2008-09", note: "Fed が金利で調整。CAPE が正常機能" },
                  { regime: "B: QE体制", period: "2008-09〜2021", note: "ZIRP+QE。CAPE 無効化。流動性主導" },
                  { regime: "C: 引き締め", period: "2022〜現在",   note: "QT+利上げ。新環境（n=7、参考程度）" },
                ].map(r => (
                  <tr key={r.regime} className="border-t border-white/[0.09]">
                    <td className="px-4 py-2.5 font-mono text-xs text-[#38bdf8]">{r.regime}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.period}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* H1: phi2 体制普遍性 */}
          <div className="rounded-2xl border border-[#34d399]/25 bg-[#34d399]/[0.06] px-4 py-3.5 mb-3">
            <p className="font-mono text-xs font-bold text-[#34d399] mb-1">発見①: phi2 v3 は全体制で有効（体制非依存）</p>
            <div className="grid grid-cols-3 gap-2 mt-2">
              {[
                { label: "A 従来型", z: "Z = 7.61", mu: "+11.8%", n: "n=20" },
                { label: "B QE体制", z: "Z = 5.33", mu: "+7.95%", n: "n=76" },
                { label: "C 引締め", z: "Z = 4.12", mu: "+14.6%", n: "n=7" },
              ].map(r => (
                <div key={r.label} className="rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2 text-center">
                  <p className="font-mono text-[10px] text-slate-500">{r.label}</p>
                  <p className="font-mono text-sm font-bold text-[#34d399] mt-0.5">{r.z}</p>
                  <p className="font-mono text-[10px] text-slate-400">{r.mu} · {r.n}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              Fed がQEをしていようとQTをしていようと、phi2（恐怖の過剰反応）は有効。
              行動経済学的な「セリングクライマックスの過剰反応」は体制を問わず発生する。
            </p>
          </div>

          {/* H3: CAPE逆説確定 */}
          <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3.5 mb-3">
            <p className="font-mono text-xs font-bold text-amber-400 mb-1">発見②: QE体制で「高CAPE = より高品質」（逆説確定）</p>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {[
                { label: "CAPE > 25（高評価）", z: "Z = 7.93", mu: "+17.7%", n: "n=20", color: "text-amber-400 border-amber-400/30" },
                { label: "CAPE ≤ 25（低評価）", z: "Z = 2.80", mu: "+4.5%",  n: "n=56", color: "text-slate-400 border-white/[0.09]" },
              ].map(r => (
                <div key={r.label} className={`rounded-xl border bg-white/[0.04] px-3 py-2 text-center ${r.color}`}>
                  <p className="font-mono text-[10px]">{r.label}</p>
                  <p className="font-mono text-sm font-bold mt-0.5">{r.z}</p>
                  <p className="font-mono text-[10px]">{r.mu} · {r.n}</p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-400">
              QE体制で高CAPEの phi2 の方が圧倒的に高品質（+13.2%の差）。
              構造的理由: 高CAPE = Fed が積極的QEを継続中 = 流動性が充分 = 株式の底割れリスクが低い。
              「高く買っても戻る」のはバリュエーションではなく流動性が支配しているから。
              <span className="font-mono text-amber-400/80"> → 次のQE体制ではCAPEが高くても phi2 を躊躇わない根拠。</span>
            </p>
          </div>

          {/* H4: CRS体制依存性 */}
          <div className="rounded-2xl border border-violet-400/25 bg-violet-400/[0.06] px-4 py-3.5">
            <p className="font-mono text-xs font-bold text-violet-300 mb-1">発見③: CRS=5-6 は QE体制にのみ発生する（30年データ）</p>
            <p className="mt-1 text-xs leading-5 text-slate-400">
              VIX急騰・HYG急落・DXY急騰が同時発生するには「グローバル流動性危機」が必要。
              これはGFC（2008〜09）・コロナショック（2020）・ユーロ圏危機（2011〜12）など、
              全てQE体制内のイベント。従来型（A）・引き締め体制（C）では CRS=5-6 は ゼロ。
            </p>
            <p className="mt-2 text-xs font-medium text-violet-300">
              CRS=5-6 が発動する = 「Fed が無制限緩和に動く圧力が極めて高い局面」を間接的に意味する可能性がある。
            </p>
          </div>
        </section>

        {/* 区切り */}
        <div className="mt-12 border-t border-white/[0.12] pt-10">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">なぜこのアプローチか — 検証で分かったこと</p>
          <p className="mt-2 text-sm leading-7 text-slate-400">
            「もっと安く買えたはず」「今は待つべきだ」——その直感を、30年分のデータで全部検証した。
            結論は、投資の常識をなぞるようでいて、行動を変えるものだった。
          </p>
        </div>

        {/* 検証レッスン */}
        <div className="mt-8 space-y-10">
          {lessons.map((l) => (
            <section key={l.id}>
              <p className="font-mono text-[10px] uppercase tracking-widest text-[#38bdf8]/60">{l.tag}</p>
              <h2 className="mt-1 text-lg font-semibold text-[#e8f4ff]">{l.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">{l.lead}</p>

              {l.rows && (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
                  <table className="w-full text-sm">
                    <tbody>
                      {l.rows.map((r) => (
                        <tr key={r.label} className="border-t border-white/[0.09] first:border-t-0">
                          <td className="px-4 py-2.5 text-slate-400">{r.label}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-[#34d399] tabular-nums">{r.value}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] text-slate-400">{r.note ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {l.body.map((p, i) => (
                <p key={i} className="mt-4 text-sm leading-6 text-slate-400">{p}</p>
              ))}

              <div className="mt-4 rounded-2xl border border-[#34d399]/20 bg-[#34d399]/[0.06] px-4 py-3 backdrop-blur-sm">
                <p className="text-sm font-medium leading-6 text-[#34d399]">{l.takeaway}</p>
              </div>
            </section>
          ))}
        </div>

        {/* クロージング */}
        <div className="mt-12 border-t border-white/[0.12] pt-8">
          <p className="text-base font-medium leading-7 text-[#e8f4ff]">{closing}</p>
          <Link
            href="/signal"
            className="mt-5 inline-block rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-5 py-2.5 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/20 transition-colors tracking-wide backdrop-blur-sm"
          >
            → 今日のシグナルを見る
          </Link>
        </div>

        <p className="mt-8 font-mono text-[10px] leading-6 text-slate-400">
          数値はS&P500等の過去データに対する自前バックテスト（engine/archive）由来。
          過去の分布であり、将来を保証しません。これは投資助言ではなく事実の提示です。
        </p>
      </main>
    </div>
  );
}
