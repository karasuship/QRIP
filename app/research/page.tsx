import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "QRIP — 検証書庫",
  description: "Round 01〜43の検証アーカイブ。採用・棄却の全記録と根拠。",
};

export const revalidate = 86400;

const ADOPTED = [
  {
    name: "phi2 v3",
    round: "Round 29 (最終確定)",
    stat: "TEST Z=+8.65 / DCA比+13.6%（63日）",
    condition: "ATH-10%以下 AND 当日-2%以下 AND vol20>25% AND ageAth∉[91-252] AND CRS≥2",
    color: "border-[#34d399]/30 bg-[#34d399]/[0.06] text-[#34d399]",
    story:
      "Round 05〜29をかけて条件を段階的に洗練。v1は「ATH-10%かつ当日-2%」のみだったが、GFCのL字回復局面（Round 19）と恐怖回復局面（Round 28）での失敗パターンを排除し、CRSフィルタ（Round 28）を加えてv3に到達。Bonferroni補正90テスト後も有意。",
    href: "/glossary#phi2",
  },
  {
    name: "RSI<25 シグナル",
    round: "Round 09〜11",
    stat: "TEST Z=+3.92 / 勝率90%",
    condition: "14日RSIが25を下抜けた瞬間",
    color: "border-amber-400/30 bg-amber-400/[0.06] text-amber-400",
    story:
      "phi2との重複率5%（ほぼ独立）。単体ではTRAIN Z=+0.06（ランダム水準）だがTEST勝率90%はリアル。Jackknife分析でドットコム期間の希釈が原因と判明（Round 11）。全サブ期間でDCAを上回ることを確認。",
    href: "/glossary#rsi25",
  },
  {
    name: "HYG-8% QE後",
    round: "Round 11, 16",
    stat: "TEST Z=+9.42 / 勝率95%",
    condition: "HYG 60日高値-8%以下 AND 2009-03以降",
    color: "border-[#34d399]/30 bg-[#34d399]/[0.06] text-[#34d399]",
    story:
      "最重要発見の一つ：同じシグナルがQE前後で「倒産連鎖の予兆（-7.72%）」から「FRB介入のV字回復の引き金（+11.21%）」へ完全反転。政策体制がシグナルの意味を書き換えることを証明した。条件付き採用。",
    href: "/glossary#hyg8",
  },
  {
    name: "B4（phi2 後追い）",
    round: "Round 16, 18",
    stat: "TEST Z=+8.29 / DCA比+6.57%",
    condition: "phi2発動から7営業日後 AND 今日もATH-10%圏内",
    color: "border-sky-400/30 bg-sky-400/[0.06] text-sky-400",
    story:
      "phi2発動時に「買い遅れた」ケースのためのシグナル。phi2アルファが最初の63日に集中するため（Round 39）、7日後でも有効。phi2と組み合わせると年間買いタイミングが1〜2回増える。",
    href: "/glossary#b4",
  },
  {
    name: "EFA（先進国）",
    round: "Round 42",
    stat: "TEST Z=+8.08 / DCA比+15.6%",
    condition: "EFA ATH-10%以下 AND SP500 CRS≥2",
    color: "border-slate-400/30 bg-slate-400/[0.06] text-slate-400",
    story:
      "SP500のCRSがグローバル危機を検知することを確認。米国以外の先進国株式ETFにも同じロジックが適用できる。phi2発動時にSP500+EFA同時購入が統計的に支持される。",
    href: "/glossary#efa",
  },
];

const REJECTED = [
  {
    name: "金利シグナル（TNX / IRX / スプレッド）",
    rounds: "Round 17, 18, 22",
    reason: "QE前後で意味が完全逆転。「金利上昇→株安」がQE期間中は成立しなかった。体制依存のシグナルは恒常的なルールとして採用不可。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "ATHティア別条件（-10%〜-15%、-15%〜-20%等）",
    rounds: "Round 40",
    reason: "TRAIN/TESTの深度分布が逆転（GFCでの過学習リスク）。最高品質ゾーンは-15%〜-20%だが、それを条件にするとTESTが壊れる。シグナル条件に組み込まず参考情報に留める。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "分割買い（発動後2〜4回に分けて投入）",
    rounds: "Round 26",
    reason: "全額即日投入が最良。アルファは最初の63日に集中しており（Round 39）、分割するほど逃げる。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "CAPE逆説（高CAPE環境でのシグナル有効性）",
    rounds: "Round 35",
    reason: "高CAPE（30〜35）でもTEST Z=+6.72で動くが、「CAPEが高いから下がる」という論理が成立しないことも示した。QE市場ではファンダメンタル指標が無効化される局面がある。CAPE単独シグナルは不採用。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "出口戦略（RSI>55 / 一定日数後売り）",
    rounds: "Round 39, 43",
    reason: "HOLDが最良。売り戦略との差は30年で14〜16万円（年5,000円未満）。税金・手数料を考えると明確にHOLD優位。RSI>55の素早い出口はTEST Z=−1.12で非推奨。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "日経225・USD/JPY・N225 連動シグナル",
    rounds: "Round 33, 34",
    reason: "日米市場の相関は高いが、日経固有のシグナルはSP500より統計品質が低い。現時点では「SP500のCRSで日経も動く」という暫定結論。日本株専用シグナルは別途研究が必要。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
  {
    name: "個別高ボラ株（TSLA・NVDA等）への phi2 適用",
    rounds: "Round 36",
    reason: "月次上限ヒット過多、体制変化で機能せず。phi2は分散インデックス専用。個別株は別のロジックが必要（現在研究中）。",
    color: "border-[#f87171]/20 bg-[#f87171]/[0.04] text-[#f87171]/70",
  },
];

const METHODOLOGY = [
  { step: "01", title: "仮説を先に立てる", desc: "データを見る前に「なぜこの条件は有効なはずか」の因果の筋を一本通す。後付け理由の発見は採用しない（地雷①）。" },
  { step: "02", title: "TRAIN/TEST を完全分離", desc: "1994〜2010をTRAIN（条件決定）、2011〜2026をTEST（独立検証）。TRAINとTESTを混ぜた検証は無効。" },
  { step: "03", title: "Bonferroni補正を適用", desc: "90以上の仮説を検証したため、偽陽性率を補正（p=0.05/90）。補正後に有意（Z>3.30）なもののみ採用候補。" },
  { step: "04", title: "Jackknife で頑健性を確認", desc: "特定の時代（GFC・コロナ等）だけに依存した成績でないか、期間を変えて繰り返し検証する。" },
  { step: "05", title: "失敗を捨てない", desc: "棄却された仮説も全てアーカイブに保存。失敗の数こそ、成功が本物か偶然かの判定材料。" },
];

export default function ResearchPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Research / 検証書庫</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">検証書庫</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400 max-w-2xl">
            2025〜2026年にかけて行った統計検証（Round 01〜43）の記録。
            採用したシグナルとその根拠、棄却した仮説とその理由を公開する。
            「このサイトのロジックでは」と言える根拠がここにある。
          </p>
        </div>

        {/* 検証方法論 */}
        <section className="mt-8">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">検証の方法論</p>
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5 space-y-3">
            {METHODOLOGY.map((m) => (
              <div key={m.step} className="flex gap-4">
                <span className="font-mono text-[10px] text-slate-500 shrink-0 pt-0.5 w-6">{m.step}</span>
                <div>
                  <p className="font-mono text-xs font-semibold text-slate-300">{m.title}</p>
                  <p className="mt-0.5 text-[11px] leading-5 text-slate-500">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 採用シグナル */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">採用シグナル（5本）</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>
          <div className="space-y-4">
            {ADOPTED.map((s) => (
              <div key={s.name} className={`rounded-2xl border p-5 backdrop-blur-sm ${s.color}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
                  <div>
                    <p className="font-mono text-sm font-bold text-[#e8f4ff]">{s.name}</p>
                    <p className="font-mono text-[10px] text-slate-500 mt-0.5">{s.round}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[10px] ${s.color}`}>
                    {s.stat}
                  </span>
                </div>
                <p className="font-mono text-[10px] text-slate-500 mb-2 bg-white/[0.14] rounded-lg px-3 py-1.5">
                  条件: {s.condition}
                </p>
                <p className="text-[11px] leading-6 text-slate-400">{s.story}</p>
                <Link href={s.href} className="mt-2 inline-block font-mono text-[10px] text-slate-500 hover:text-slate-400 transition-colors">
                  → 用語集で詳細を見る
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* 棄却された仮説 */}
        <section className="mt-8">
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">棄却された仮説（一部）</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>
          <p className="mb-3 text-[11px] text-slate-500">
            棄却された仮説こそが「なぜ採用シグナルが本物か」を支える証拠。全てアーカイブに保存されている。
          </p>
          <div className="space-y-3">
            {REJECTED.map((r) => (
              <div key={r.name} className={`rounded-xl border p-4 ${r.color}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="font-mono text-xs font-semibold text-slate-400">{r.name}</p>
                  <span className="font-mono text-[10px] text-slate-500">{r.rounds}</span>
                </div>
                <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{r.reason}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 研究中 */}
        <section className="mt-8 rounded-2xl border border-white/[0.15] bg-white/[0.11] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">現在研究中</p>
          <div className="space-y-2.5 text-[11px] leading-6 text-slate-500">
            <p>· <span className="text-slate-400">個別株シグナル（配当株・成熟株）</span> — NTT・JT等のような低ボラ高配当株への独自ロジック検証</p>
            <p>· <span className="text-slate-400">FOMC声明スコアリング</span> — FRBの声明文から政策体制を自動分類</p>
            <p>· <span className="text-slate-400">大口フロー推定</span> — 出来高・価格動態から「誰の金で動いているか」を推定</p>
          </div>
          <p className="mt-4 font-mono text-[10px] text-slate-500">
            仮説の提案・投票は{" "}
            <Link href="/board" className="text-slate-500 hover:text-slate-300 transition-colors">掲示板</Link>
            {" "}から。採用候補になった仮説はここに記録される。
          </p>
        </section>

        <p className="mt-8 font-mono text-[10px] leading-6 text-slate-500">
          Zスコアはバックテスト期間（1994〜2026）の統計値。将来の成果を保証しません。
          これは投資助言ではありません。用語の詳細は{" "}
          <Link href="/glossary" className="text-slate-500 hover:text-slate-400">用語集</Link>
          {" "}を参照。
        </p>
      </main>
    </div>
  );
}
