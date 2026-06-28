import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "成長加速企業レーダー — 売上成長トップ10と入れ替え予測",
  description: "米国大型株の3年売上CAGR上位10社を毎年動的に選定。Mag7の入れ替え予測・次世代候補を可視化。Round 52 バックテスト（2019-2026）に基づく。",
};

export const revalidate = 86400;

// ── Round 52 データ（2026-06-29 更新） ─────────────────────────────────────

const YEARLY_BASKETS: Record<number, { ticker: string; cagr: number; inMag7?: boolean }[]> = {
  2019: [
    { ticker: "TSLA", cagr: 75, inMag7: true },
    { ticker: "SHOP", cagr: 72 },
    { ticker: "META", cagr: 46, inMag7: true },
    { ticker: "AVGO", cagr: 45 },
    { ticker: "NOW",  cagr: 42 },
    { ticker: "NVDA", cagr: 36, inMag7: true },
    { ticker: "NFLX", cagr: 32 },
    { ticker: "AMZN", cagr: 30, inMag7: true },
    { ticker: "CRM",  cagr: 25 },
    { ticker: "ADBE", cagr: 23 },
  ],
  2020: [
    { ticker: "SHOP", cagr: 59 },
    { ticker: "TSLA", cagr: 52, inMag7: true },
    { ticker: "NOW",  cagr: 45 },
    { ticker: "META", cagr: 37, inMag7: true },
    { ticker: "NFLX", cagr: 32 },
    { ticker: "AMZN", cagr: 27, inMag7: true },
    { ticker: "CRM",  cagr: 26 },
    { ticker: "ADBE", cagr: 24 },
    { ticker: "GOOGL",cagr: 22, inMag7: true },
    { ticker: "AVGO", cagr: 20 },
  ],
  2021: [
    { ticker: "SHOP", cagr: 64 },
    { ticker: "NOW",  cagr: 44 },
    { ticker: "TSLA", cagr: 39, inMag7: true },
    { ticker: "AMZN", cagr: 29, inMag7: true },
    { ticker: "NFLX", cagr: 29 },
    { ticker: "META", cagr: 28, inMag7: true },
    { ticker: "CRM",  cagr: 27 },
    { ticker: "AMD",  cagr: 22 },
    { ticker: "ADBE", cagr: 21 },
    { ticker: "GOOGL",cagr: 18, inMag7: true },
  ],
  2022: [
    { ticker: "SHOP", cagr: 63 },
    { ticker: "AMD",  cagr: 52 },
    { ticker: "TSLA", cagr: 49, inMag7: true },
    { ticker: "NVDA", cagr: 32, inMag7: true },
    { ticker: "META", cagr: 28, inMag7: true },
    { ticker: "CRM",  cagr: 27 },
    { ticker: "AMZN", cagr: 26, inMag7: true },
    { ticker: "NFLX", cagr: 24 },
    { ticker: "GOOGL",cagr: 23, inMag7: true },
    { ticker: "MSFT", cagr: 16, inMag7: true },
  ],
  2023: [
    { ticker: "SHOP", cagr: 52 },
    { ticker: "AMD",  cagr: 52 },
    { ticker: "TSLA", cagr: 49, inMag7: true },
    { ticker: "UBER", cagr: 35 },
    { ticker: "NOW",  cagr: 30 },
    { ticker: "AMZN", cagr: 22, inMag7: true },
    { ticker: "QCOM", cagr: 22 },
    { ticker: "GOOGL",cagr: 20, inMag7: true },
    { ticker: "META", cagr: 18, inMag7: true },
    { ticker: "MSFT", cagr: 16, inMag7: true },
  ],
  2024: [
    { ticker: "UBER", cagr: 50 },
    { ticker: "TSLA", cagr: 45, inMag7: true },
    { ticker: "SHOP", cagr: 34 },
    { ticker: "AMD",  cagr: 32 },
    { ticker: "PLTR", cagr: 27 },
    { ticker: "NOW",  cagr: 26 },
    { ticker: "CRM",  cagr: 22 },
    { ticker: "NVDA", cagr: 22, inMag7: true },
    { ticker: "GOOGL",cagr: 19, inMag7: true },
    { ticker: "MA",   cagr: 18 },
  ],
  2025: [
    { ticker: "UBER", cagr: 36 },
    { ticker: "NVDA", cagr: 31, inMag7: true },
    { ticker: "SHOP", cagr: 24 },
    { ticker: "AVGO", cagr: 23 },
    { ticker: "NOW",  cagr: 23 },
    { ticker: "PLTR", cagr: 23 },
    { ticker: "TSLA", cagr: 22, inMag7: true },
    { ticker: "CRM",  cagr: 18 },
    { ticker: "AMD",  cagr: 16 },
    { ticker: "V",    cagr: 14 },
  ],
};

// 2026末時点の最新ランキング（→2027年保有候補）
const CURRENT_RANKING = [
  { ticker: "NVDA",  cagr: 100, inMag7: true,  note: "AI GPU 独占。FY2024売上+122%" },
  { ticker: "PLTR",  cagr: 33,  inMag7: false, note: "AI/防衛データ分析。政府・企業需要急増" },
  { ticker: "LLY",   cagr: 32,  inMag7: false, note: "GLP-1肥満薬（Mounjaro等）で売上爆増" },
  { ticker: "SHOP",  cagr: 27,  inMag7: false, note: "EC SaaS。GMV成長継続" },
  { ticker: "AVGO",  cagr: 24,  inMag7: false, note: "AIカスタムチップ（XPU）+ VMware統合" },
  { ticker: "NOW",   cagr: 22,  inMag7: false, note: "エンタープライズAI ワークフロー自動化" },
  { ticker: "META",  cagr: 20,  inMag7: true,  note: "広告AI最適化で収益急回復" },
  { ticker: "UBER",  cagr: 18,  inMag7: false, note: "ライドシェア + 配送の黒字化完成" },
  { ticker: "ASML",  cagr: 16,  inMag7: false, note: "EUV露光装置。AI半導体需要の根幹" },
  { ticker: "INTU",  cagr: 14,  inMag7: false, note: "TurboTax + QuickBooks AI化で成長加速" },
];

// 注目銘柄のランクイン履歴
const WATCH_HISTORY: Record<string, { year: number; rank: number | null; cagr: number | null }[]> = {
  NVDA:  [
    { year: 2018, rank: 6,    cagr: 36 },
    { year: 2019, rank: 11,   cagr: 16 },
    { year: 2020, rank: 11,   cagr: 15 },
    { year: 2021, rank: 5,    cagr: 32 },
    { year: 2022, rank: null, cagr: null },
    { year: 2023, rank: 8,    cagr: 22 },
    { year: 2024, rank: 2,    cagr: 31 },
    { year: 2025, rank: 1,    cagr: 100 },
  ],
  TSLA:  [
    { year: 2018, rank: 1,  cagr: 75 },
    { year: 2019, rank: 2,  cagr: 52 },
    { year: 2020, rank: 3,  cagr: 39 },
    { year: 2021, rank: 4,  cagr: 36 },
    { year: 2022, rank: 3,  cagr: 49 },
    { year: 2023, rank: 2,  cagr: 45 },
    { year: 2024, rank: 7,  cagr: 22 },
    { year: 2025, rank: 28, cagr: 5 },
  ],
  AMD:   [
    { year: 2018, rank: 12, cagr: 18 },
    { year: 2019, rank: 13, cagr: 16 },
    { year: 2020, rank: 8,  cagr: 22 },
    { year: 2021, rank: 3,  cagr: 36 },
    { year: 2022, rank: 2,  cagr: 52 },
    { year: 2023, rank: 4,  cagr: 32 },
    { year: 2024, rank: 9,  cagr: 16 },
    { year: 2025, rank: 12, cagr: 14 },
  ],
  PLTR:  [
    { year: 2021, rank: null, cagr: null },
    { year: 2022, rank: null, cagr: null },
    { year: 2023, rank: 5,    cagr: 27 },
    { year: 2024, rank: 6,    cagr: 23 },
    { year: 2025, rank: 2,    cagr: 33 },
  ],
  SHOP:  [
    { year: 2018, rank: 2,  cagr: 72 },
    { year: 2019, rank: 1,  cagr: 59 },
    { year: 2020, rank: 1,  cagr: 64 },
    { year: 2021, rank: 1,  cagr: 63 },
    { year: 2022, rank: 1,  cagr: 52 },
    { year: 2023, rank: 3,  cagr: 34 },
    { year: 2024, rank: 3,  cagr: 24 },
    { year: 2025, rank: 3,  cagr: 27 },
  ],
};

// 年次リターン比較
const YEARLY_RETURNS: Record<number, { dynamic: number; mag7: number }> = {
  2019: { dynamic: 54.4,  mag7: 50.5  },
  2020: { dynamic: 130.5, mag7: 155.2 },
  2021: { dynamic: 29.5,  mag7: 51.5  },
  2022: { dynamic: -54.3, mag7: -47.3 },
  2023: { dynamic: 101.9, mag7: 115.2 },
  2024: { dynamic: 78.1,  mag7: 63.6  },
  2025: { dynamic: 36.3,  mag7: 23.3  },
  2026: { dynamic: -10.0, mag7: -4.6  },
};

const YEARS = Object.keys(YEARLY_BASKETS).map(Number).sort();
const WATCH_TICKERS = Object.keys(WATCH_HISTORY);

function CagrBadge({ cagr, inMag7 }: { cagr: number; inMag7?: boolean }) {
  const cls = cagr >= 50
    ? "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]"
    : cagr >= 25
    ? "border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] text-[#38bdf8]"
    : cagr >= 15
    ? "border-amber-400/30 bg-amber-400/[0.06] text-amber-400"
    : "border-white/[0.18] bg-white/[0.04] text-slate-400";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[9px] ${cls}`}>
      {inMag7 && <span className="text-[#38bdf8]">★</span>}
      +{cagr}%
    </span>
  );
}

function ReturnDiff({ dynamic, mag7 }: { dynamic: number; mag7: number }) {
  const diff = dynamic - mag7;
  const cls = diff > 0 ? "text-[#34d399]" : diff < 0 ? "text-[#f87171]" : "text-slate-500";
  return <span className={`font-mono text-[10px] ${cls}`}>{diff > 0 ? "+" : ""}{diff.toFixed(1)}%</span>;
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "成長加速企業レーダー — 売上成長トップ10と入れ替え予測（2019-2026 バックテスト）",
  "description": "米国大型株の3年売上CAGR上位10社を毎年動的に選定し固定Mag7と比較。NVDA・TSLAの入れ替え予測と次世代候補を可視化。",
  "url": "https://qrip-eight.vercel.app/radar",
  "publisher": { "@type": "Organization", "name": "QRIP", "url": "https://qrip-eight.vercel.app" },
  "inLanguage": "ja",
};

export default function RadarPage() {
  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Radar / 成長レーダー</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">成長加速企業レーダー</h1>
          <p className="mt-2 text-sm leading-7 text-slate-400 max-w-2xl">
            米国大型株 ~60社の3年売上 CAGR を毎年ランキング。
            「Mag7」は固定ラベルではなく、その時代の成長トップ企業のスナップショット。
            入れ替わりを予測し、次世代候補を可視化する。
          </p>
        </div>

        {/* 今期の成長ランキング */}
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">2026末 → 2027年 保有候補</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>
          <p className="mb-4 text-[11px] text-slate-500">
            売上成長 3年 CAGR 上位10社。<span className="text-[#38bdf8]">★</span> = Mag7 銘柄。
          </p>
          <div className="space-y-2">
            {CURRENT_RANKING.map((s, i) => (
              <div
                key={s.ticker}
                className="flex items-center gap-3 rounded-xl border border-white/[0.18] bg-white/[0.04] px-4 py-3 backdrop-blur-sm"
              >
                <span className="font-mono text-[10px] text-slate-500 w-5 shrink-0">{i + 1}</span>
                <span className={`font-mono text-sm font-bold w-12 shrink-0 ${s.inMag7 ? "text-[#38bdf8]" : "text-[#e8f4ff]"}`}>
                  {s.ticker}
                </span>
                <CagrBadge cagr={s.cagr} inMag7={s.inMag7} />
                <p className="text-[11px] text-slate-500 leading-5 flex-1 hidden sm:block">{s.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 font-mono text-[9px] text-slate-600">
            ※ 売上CAGR は公開財務諸表から算出。Round 52 バックテスト（2026-06-29）。投資助言ではありません。
          </p>
        </section>

        {/* 動的 vs Mag7 年次リターン比較 */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">動的Top10 vs 固定Mag7 年次リターン</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                  {["年", "動的Top10", "固定Mag7", "差"].map(h => (
                    <th key={h} className="px-4 py-2.5 font-mono text-[9px] text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(YEARLY_RETURNS).map(([yr, r]) => {
                  const dynCls = r.dynamic >= 0 ? "text-[#34d399]" : "text-[#f87171]";
                  const mag7Cls = r.mag7 >= 0 ? "text-[#38bdf8]" : "text-[#f87171]";
                  return (
                    <tr key={yr} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                      <td className="px-4 py-2.5 font-mono text-[10px] text-slate-400">{yr}</td>
                      <td className={`px-4 py-2.5 font-mono text-xs font-semibold ${dynCls}`}>
                        {r.dynamic > 0 ? "+" : ""}{r.dynamic.toFixed(1)}%
                      </td>
                      <td className={`px-4 py-2.5 font-mono text-xs ${mag7Cls}`}>
                        {r.mag7 > 0 ? "+" : ""}{r.mag7.toFixed(1)}%
                      </td>
                      <td className="px-4 py-2.5">
                        <ReturnDiff dynamic={r.dynamic} mag7={r.mag7} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-white/[0.15] bg-white/[0.06]">
                  <td className="px-4 py-2.5 font-mono text-[9px] text-slate-500">8年累計</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#34d399] font-semibold">+828%（年率+32%）</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#38bdf8]">+1171%（年率+37%）</td>
                  <td className="px-4 py-2.5 font-mono text-[10px] text-[#f87171]">-5%/年</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            固定Mag7が年率+5%上回る。ただし2024・2025年は動的が逆転。Mag7の成長鈍化（AAPL・TSLA）が進むほど動的が有利になる。
          </p>
        </section>

        {/* 各年のバスケット */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">年次バスケット履歴</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>
          <div className="space-y-3">
            {YEARS.map(y => (
              <div key={y} className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-4 py-3">
                <p className="font-mono text-[10px] text-slate-500 mb-2">
                  {y}末選定 → {y + 1}年保有
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {YEARLY_BASKETS[y].map((s, i) => (
                    <span
                      key={s.ticker}
                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-mono text-[10px] ${
                        s.inMag7
                          ? "border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] text-[#38bdf8]"
                          : "border-white/[0.18] bg-white/[0.04] text-slate-300"
                      }`}
                    >
                      <span className="text-slate-500">{i + 1}.</span>
                      {s.ticker}
                      <span className="text-[8px] text-slate-500">+{s.cagr}%</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 注目銘柄のランク推移 */}
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.13]" />
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">注目銘柄のランク推移</p>
            <div className="h-px flex-1 bg-white/[0.13]" />
          </div>
          <p className="mb-4 text-[11px] text-slate-500">
            NVDA は 2018 年の段階で既に6位（+36%）に入っていた。株価爆発は 2023 年だが、売上の数字は5年前から出ていた。
          </p>

          <div className="overflow-x-auto rounded-2xl border border-white/[0.18]">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/[0.15] bg-white/[0.06]">
                  <th className="px-3 py-2.5 font-mono text-[9px] text-slate-500">銘柄</th>
                  {[2018,2019,2020,2021,2022,2023,2024,2025].map(y => (
                    <th key={y} className="px-3 py-2.5 font-mono text-[9px] text-slate-500 text-center">{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WATCH_TICKERS.map(t => {
                  const history = WATCH_HISTORY[t];
                  return (
                    <tr key={t} className="border-b border-white/[0.06] hover:bg-white/[0.04] transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs font-semibold text-[#e8f4ff]">{t}</td>
                      {[2018,2019,2020,2021,2022,2023,2024,2025].map(y => {
                        const h = history.find(d => d.year === y);
                        if (!h) return (
                          <td key={y} className="px-3 py-2.5 text-center font-mono text-[9px] text-slate-600">—</td>
                        );
                        const cls = !h.rank ? "text-slate-600"
                          : h.rank <= 3 ? "text-[#34d399] font-semibold"
                          : h.rank <= 10 ? "text-[#38bdf8]"
                          : "text-slate-500";
                        return (
                          <td key={y} className={`px-3 py-2.5 text-center font-mono text-[10px] ${cls}`}>
                            {h.rank ? `${h.rank}位` : "圏外"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 font-mono text-[9px] text-slate-500">
            <span className="text-[#34d399]">■</span> 1〜3位（トップ3）
            <span className="text-[#38bdf8] ml-2">■</span> 4〜10位（バスケット入り）
            <span className="ml-2">■</span> 10位以下・圏外
          </div>
        </section>

        {/* 入れ替えの予測可能性 */}
        <section className="mt-10 rounded-2xl border border-white/[0.18] bg-white/[0.04] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">入れ替えの予測可能性</p>
          <div className="space-y-3 text-[11px] leading-6 text-slate-400">
            <p>
              <span className="text-[#34d399] font-semibold">NVDA の事例：</span>
              2018年末時点で売上CAGR+36%（6位）。当時は「ゲーミングGPU会社」という認識だったが、
              データセンター収益の急増は決算書に既に現れていた。
              株価が本格爆発する2023年の5年前に、この指標でランクインしていた。
            </p>
            <p>
              <span className="text-amber-400 font-semibold">TSLA の事例：</span>
              2018〜2022年は常にトップ5。生産台数の指数的増加が売上に直結していた。
              2023年以降は成長率が鈍化（+5%/年）し、ランクアウト。「成長期」の終わりも数字に先行して出た。
            </p>
            <p>
              <span className="text-[#38bdf8] font-semibold">次の候補：</span>
              PLTR（+33%/年）、LLY（GLP-1薬 +32%）、AVGO（AIカスタムチップ +24%）。
              これらは現時点でMag7ではないが、売上成長率の観点では既にMag7の多くを上回っている。
            </p>
          </div>
        </section>

        <p className="mt-8 font-mono text-[9px] leading-6 text-slate-600">
          データは公開財務諸表から算出。yfinance + 補完データ。
          Round 52 バックテスト（2026-06-29 実施）に基づく。
          サバイバーシップバイアスあり。将来の成果を保証しません。投資助言ではありません。
          詳細は <Link href="/research" className="text-slate-500 hover:text-slate-400">検証書庫</Link> を参照。
        </p>
      </main>
    </div>
  );
}
