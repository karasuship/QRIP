import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "デモ — QRIPでできること",
  description: "シグナル通知・試算・暴落スコアリング・銘柄日誌。QRIPの主要機能をサンプルポートフォリオで体験。",
};

// ── サンプルデータ ─────────────────────────────────────────────────────────────

const DEMO_PORTFOLIO = [
  { name: "VOO（S&P500）",      pct: 50, amount: 618_000, ret: +18.4, signal: "待機中",  signalCls: "text-slate-400" },
  { name: "QQQ（ナスダック100）", pct: 20, amount: 247_000, ret: +31.2, signal: "待機中",  signalCls: "text-slate-400" },
  { name: "VEA（先進国）",        pct: 20, amount: 247_000, ret:  +8.1, signal: "待機中",  signalCls: "text-slate-400" },
  { name: "VWO（新興国）",        pct: 10, amount: 123_000, ret:  +4.6, signal: "待機中",  signalCls: "text-slate-400" },
];

const DEMO_EVENTS = [
  { type: "phi2",          color: "green",  label: "S&P500 phi2発動",        value: "ATH −12.3%",  date: "2024-08-05", detail: "CRS 4/6。過去類似63日後中央値 +13.6%" },
  { type: "jp_buy",        color: "green",  label: "NTT 配当買いシグナル",   value: "利回り 3.61%", date: "2024-08-06", detail: "52週下位18%。配当割安ゾーン突入" },
  { type: "value_entry",   color: "purple", label: "グレアム型 新規入圏",     value: "3銘柄",        date: "2024-08-07", detail: "PBR<1.0・PER<15・自己資本50%超" },
  { type: "earnings_soon", color: "blue",   label: "AAPL 決算 2日前",        value: "2024-08-01",   date: "2024-07-30", detail: "Q3 FY2024 決算発表" },
  { type: "news_mention",  color: "yellow", label: "ニュース: NVIDIA言及",    value: "NVDA",         date: "2024-07-29", detail: "Blackwell GPU 量産開始の報道" },
];

const COLOR_DOT: Record<string, string> = {
  green: "bg-[#34d399]", purple: "bg-violet-400", blue: "bg-[#38bdf8]", yellow: "bg-amber-300", amber: "bg-amber-400",
};
const COLOR_BADGE: Record<string, string> = {
  green:  "border-[#34d399]/30 bg-[#34d399]/10 text-[#34d399]",
  purple: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  blue:   "border-[#38bdf8]/30 bg-[#38bdf8]/10 text-[#38bdf8]",
  yellow: "border-amber-300/30 bg-amber-300/10 text-amber-300",
  amber:  "border-amber-400/30 bg-amber-400/10 text-amber-400",
};

// ── サブコンポーネント ─────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-3">{children}</p>
  );
}

function FeatureCard({ href, label, desc, tag }: { href: string; label: string; desc: string; tag?: string }) {
  return (
    <Link href={href} className="group block rounded-2xl border border-white/[0.15] bg-white/[0.03] px-5 py-4 hover:border-[#38bdf8]/30 hover:bg-[#38bdf8]/[0.03] transition-all">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-semibold text-[#e8f4ff] group-hover:text-[#38bdf8] transition-colors">{label}</p>
        {tag && <span className="rounded border border-white/[0.15] px-2 py-0.5 font-mono text-[9px] text-slate-500">{tag}</span>}
      </div>
      <p className="text-[11px] leading-5 text-slate-500">{desc}</p>
      <p className="mt-2 font-mono text-[10px] text-slate-600 group-hover:text-[#38bdf8] transition-colors">
        開く <span className="inline-block group-hover:translate-x-0.5 transition-transform">→</span>
      </p>
    </Link>
  );
}

// ── メインページ ──────────────────────────────────────────────────────────────

export default function DemoPage() {
  const totalAmount = DEMO_PORTFOLIO.reduce((s, h) => s + h.amount, 0);
  const totalRet = DEMO_PORTFOLIO.reduce((s, h) => s + h.ret * h.amount / totalAmount, 0);

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* ヘッダー */}
        <div className="mb-10">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Demo</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">QRIPでできること</h1>
          <p className="mt-2 text-sm text-slate-400">
            架空のポートフォリオを使って、実際の機能を体験。
            <span className="text-slate-600"> ※ 数値はすべてサンプルデータです</span>
          </p>
        </div>

        {/* ① ポートフォリオスナップショット */}
        <section className="mb-10">
          <SectionLabel>① ポートフォリオ スナップショット</SectionLabel>
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.03] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
              <div>
                <p className="font-mono text-[10px] text-slate-500">評価総額</p>
                <p className="text-2xl font-bold tabular-nums text-[#e8f4ff]">¥1,235,000</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-slate-500">累計リターン</p>
                <p className="text-xl font-bold text-[#34d399]">+{totalRet.toFixed(1)}%</p>
              </div>
            </div>
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-white/[0.06]">
                  {["銘柄","比率","評価額","リターン","シグナル"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {DEMO_PORTFOLIO.map((h) => (
                  <tr key={h.name}>
                    <td className="px-4 py-2.5 font-medium text-slate-300">{h.name}</td>
                    <td className="px-4 py-2.5 font-mono text-slate-400">{h.pct}%</td>
                    <td className="px-4 py-2.5 font-mono text-[#e8f4ff]">¥{h.amount.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono text-[#34d399]">+{h.ret}%</td>
                    <td className={`px-4 py-2.5 font-mono text-[10px] ${h.signalCls}`}>{h.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-2.5 border-t border-white/[0.06]">
              <p className="font-mono text-[9px] text-slate-600">
                このポートフォリオの構成根拠は <Link href="/simulate" className="text-[#38bdf8]/60 hover:text-[#38bdf8]">試算ページ →</Link> で確認できます。
              </p>
            </div>
          </div>
        </section>

        {/* ② シグナルフィード */}
        <section className="mb-10">
          <SectionLabel>② シグナルフィード — いつ、何が起きたか</SectionLabel>
          <p className="text-[12px] text-slate-500 mb-4">
            相場シグナル・配当シグナル・決算リマインダー・ニュース言及が1つのフィードに集まります。
            通知設定すれば、ここを開かなくても自動で知らせます。
          </p>
          <div className="space-y-2">
            {DEMO_EVENTS.map((e, i) => (
              <div key={i} className={`flex items-center gap-3 rounded-xl border ${
                e.color === "green" ? "border-[#34d399]/20 bg-[#34d399]/[0.03]" :
                e.color === "purple" ? "border-violet-400/20 bg-violet-400/[0.03]" :
                e.color === "blue" ? "border-[#38bdf8]/20 bg-[#38bdf8]/[0.03]" :
                "border-amber-300/20 bg-amber-300/[0.03]"
              } px-4 py-3`}>
                <span className={`h-2 w-2 rounded-full shrink-0 ${COLOR_DOT[e.color]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-medium text-slate-300">{e.label}</span>
                    <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${COLOR_BADGE[e.color]}`}>{e.value}</span>
                  </div>
                  <p className="mt-0.5 font-mono text-[9px] text-slate-600">{e.detail}</p>
                </div>
                <span className="font-mono text-[9px] text-slate-600 shrink-0">{e.date}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-3 flex-wrap">
            {[
              { color: "green",  label: "相場シグナル" },
              { color: "blue",   label: "決算リマインダー" },
              { color: "yellow", label: "ニュースアラート" },
              { color: "purple", label: "バリュー株入圏" },
            ].map((l) => (
              <span key={l.label} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[9px] ${COLOR_BADGE[l.color]}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${COLOR_DOT[l.color]}`} />
                {l.label}
              </span>
            ))}
          </div>
        </section>

        {/* ③ 暴落スコアリング */}
        <section className="mb-10">
          <SectionLabel>③ 暴落スコアリング — 今、売るべきか？</SectionLabel>
          <div className="rounded-2xl border border-[#f87171]/20 bg-[#f87171]/[0.03] px-5 py-5">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xl font-bold text-[#f87171]">売りたい衝動</span>
              <div className="flex-1 h-2 rounded-full bg-white/[0.08] overflow-hidden">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-amber-400 to-[#f87171]" />
              </div>
              <span className="font-mono text-sm font-bold text-[#f87171]">72 / 100</span>
            </div>
            <p className="text-[12px] leading-6 text-slate-400 mb-4">
              このスコアが高いとき、歴史的に売ってしまったほとんどの人が<span className="text-[#f87171]">後悔</span>しています。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-[#f87171]/15 bg-white/[0.02] px-4 py-3">
                <p className="font-mono text-[9px] text-slate-600 mb-1">今売ると（損失確定）</p>
                <p className="font-mono text-xl font-bold text-[#f87171]">−12.3%</p>
                <p className="font-mono text-[9px] text-slate-600 mt-1">最高値比 現在のATH乖離</p>
              </div>
              <div className="rounded-xl border border-[#34d399]/15 bg-white/[0.02] px-4 py-3">
                <p className="font-mono text-[9px] text-slate-600 mb-1">保有継続の過去実績（63日後）</p>
                <p className="font-mono text-xl font-bold text-[#34d399]">+13.6%</p>
                <p className="font-mono text-[9px] text-slate-600 mt-1">phi2発動後 30年中央値</p>
              </div>
            </div>
            <p className="mt-4 text-[11px] text-slate-600">
              ※ phi2発動環境（ATH−10%以下・CRS≥2）での過去63日後中央値。個別の結果は異なります。
            </p>
          </div>
        </section>

        {/* ④ 日誌サンプル */}
        <section className="mb-10">
          <SectionLabel>④ 投資日誌 — なぜ買ったか、を記録する</SectionLabel>
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.03] px-5 py-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="rounded border border-[#34d399]/25 bg-[#34d399]/[0.06] px-2 py-0.5 font-mono text-[9px] text-[#34d399]">phi2発動</span>
              <span className="font-mono text-[10px] text-slate-500">2024-08-05</span>
            </div>
            <p className="text-sm font-medium text-slate-300 mb-2">VOO 追加購入 ¥200,000</p>
            <p className="text-[12px] leading-6 text-slate-500">
              phi2発動（ATH−12.3%・CRS 4/6）。過去30年のデータでこのタイミングの63日後は平均+13.6%。
              恐怖指数が上がっているが、これはシグナルが示す「買い場」の条件と一致している。
              撤退条件：ATH−25%を超えて且つCRS6/6が続く場合。
            </p>
          </div>
          <Link href="/journal" className="mt-2 flex items-center justify-end gap-1 font-mono text-[10px] text-slate-500 hover:text-[#38bdf8] transition-colors">
            日誌を書く →
          </Link>
        </section>

        {/* ⑤ 機能リンク */}
        <section>
          <SectionLabel>⑤ 今すぐ試す</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FeatureCard href="/signal"   label="買い場シグナル"     desc="今この瞬間のCRS・ATH乖離・シグナル発動状況をリアルタイム確認" tag="LIVE" />
            <FeatureCard href="/screener" label="バリュー株スクリーナー" desc="PBR・PER・配当利回りなど8指標で約3700銘柄をフィルタリング" />
            <FeatureCard href="/simulate" label="30年資産試算"       desc="毎月積立＋シグナル戦略でどれだけ差がつくかをシミュレーション" />
            <FeatureCard href="/compare"  label="戦略比較"           desc="VOO・QQQ・phi2+VOO・Mag7の期待値とリスクを時間軸別に比較" />
            <FeatureCard href="/news"     label="ニュース要約"        desc="毎日のSP500関連ニュースをClaude AIが日本語で翻訳・分析" />
            <FeatureCard href="/radar"    label="成長加速レーダー"    desc="Mag7 vs SPYの成長寄与分解。個別株ディップシグナルも掲載" />
          </div>
        </section>

        <p className="mt-10 font-mono text-[9px] text-slate-700">
          ※ このページの数値はすべてサンプルデータです。実際の運用成績ではありません。投資は自己責任で。
        </p>
      </main>
    </div>
  );
}
