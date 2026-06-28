import type { Metadata } from "next";
import Link from "next/link";
import { fetchSignal } from "@/lib/signal";
import type { SignalData } from "@/lib/signal";
import type { JpStockSignal } from "@/lib/jp-stock-signal";
import { Term } from "@/app/components/Term";
import { FlickerNumber } from "@/app/components/FlickerNumber";
import { fetchValuePatterns } from "@/lib/value-patterns";
import type { ValuePattern } from "@/lib/value-patterns";

export const metadata: Metadata = {
  title: "買い場シグナル一覧 — S&P500・ETF・日本株 リアルタイム",
  description: "S&P500・EFA・EEM・QQQ・VT・NTT・JT・KDDI の買い場シグナル発動状態をリアルタイム表示。phi2 v3・CRS スコア・RSI<25 など5本のシグナル体制。",
};

export const revalidate = 900;

function pct(n: number, sign = true): string {
  const s = (n * 100).toFixed(2) + "%";
  return sign && n >= 0 ? "+" + s : s;
}

// ── シグナル状態の設定 ─────────────────────────────────────────────────────────

const TIER_CONFIG: Record<
  SignalData["signalTier"],
  { label: string; badge: string; badgeCls: string; border: string; glow: string }
> = {
  DOUBLE: {
    label: "2つのシグナルが同時発動 — 最高品質の買い場",
    badge: "超高品質",
    badgeCls: "bg-violet-400/15 text-violet-300 border border-violet-400/30",
    border: "border-violet-400/40 bg-violet-400/[0.07]",
    glow: "shadow-[0_0_24px_rgba(167,139,250,0.15)]",
  },
  PHI2: {
    label: "phi2 シグナル発動中 — 統計的な買い場",
    badge: "発動中",
    badgeCls: "bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30",
    border: "border-[#34d399]/40 bg-[#34d399]/[0.07]",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.12)]",
  },
  RSI25: {
    label: "補助シグナル発動（確信度は低め）",
    badge: "補助発動",
    badgeCls: "bg-amber-400/15 text-amber-400 border border-amber-400/30",
    border: "border-amber-400/30 bg-amber-400/[0.05]",
    glow: "",
  },
  NEAR: {
    label: "発動に近づいている — 条件待ち",
    badge: "圏内",
    badgeCls: "bg-amber-400/10 text-amber-400/80 border border-amber-400/20",
    border: "border-amber-400/20 bg-amber-400/[0.03]",
    glow: "",
  },
  NONE: {
    label: "待機中 — 現在は通常相場",
    badge: "待機中",
    badgeCls: "bg-white/[0.08] text-slate-400 border border-white/[0.15]",
    border: "border-white/[0.20] bg-white/[0.06]",
    glow: "",
  },
};

const JP_SIGNAL_CONFIG = {
  BUY:  { label: "割安・買い場の可能性", cls: "border-[#34d399]/40 bg-[#34d399]/[0.07] text-[#34d399]", badge: "bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30" },
  HOLD: { label: "中立",                  cls: "border-white/[0.20] bg-white/[0.06] text-slate-400",      badge: "bg-white/[0.08] text-slate-400 border border-white/[0.15]" },
  SELL: { label: "割高・注意",            cls: "border-[#f87171]/40 bg-[#f87171]/[0.07] text-[#f87171]", badge: "bg-[#f87171]/15 text-[#f87171] border border-[#f87171]/30" },
};

// ── カテゴリヘッダー ───────────────────────────────────────────────────────────

function SectionHeader({
  title, desc, accent = "#38bdf8",
}: { title: string; desc: string; accent?: string }) {
  return (
    <div className="mt-10 mb-5">
      <div className="flex items-center gap-3 mb-2">
        <div className="h-5 w-1 rounded-full shrink-0" style={{ background: accent }} />
        <span className="text-sm font-bold text-[#e8f4ff]">{title}</span>
        <span className="flex-1 border-t border-white/[0.18]" />
      </div>
      <p className="pl-4 text-[12px] leading-5 text-slate-400">{desc}</p>
    </div>
  );
}

// ── タップ可能なカードの共通フッター ──────────────────────────────────────────

function CardFooter() {
  return (
    <p className="mt-4 flex items-center justify-end gap-1 font-mono text-[10px] text-slate-500 group-hover:text-[#38bdf8] transition-colors">
      詳細を見る
      <span className="inline-block translate-x-0 group-hover:translate-x-1 transition-transform">→</span>
    </p>
  );
}

// ── カード共通クラス ───────────────────────────────────────────────────────────

function cardCls(border: string, glow: string) {
  return `rounded-2xl border p-5 backdrop-blur-sm transition-all duration-200 cursor-pointer group-hover:-translate-y-0.5 ${border} ${glow} group-hover:border-opacity-80`;
}

// ── バリュー株パターンカード ──────────────────────────────────────────────────

function ValuePatternCard({ pattern }: { pattern: ValuePattern }) {
  function fmtMetric(stock: ValuePattern["stocks"][number]): string {
    const v = stock[pattern.keyMetric];
    if (v == null) return "—";
    if (pattern.keyMetric === "pbr") return `${v.toFixed(2)}倍`;
    return `${(v * 100).toFixed(1)}%`;
  }

  return (
    <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[0.03] p-5">
      <div className="flex items-start justify-between mb-1">
        <p className="text-sm font-bold text-[#e8f4ff]">{pattern.name}</p>
        <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.08] px-2.5 py-0.5 font-mono text-[9px] text-amber-400">
          {pattern.stocks.length}銘柄該当
        </span>
      </div>
      <p className="text-[11px] text-slate-400 mb-2">{pattern.desc}</p>
      <p className="font-mono text-[9px] text-slate-600 mb-4">{pattern.basis}</p>

      {pattern.stocks.length > 0 ? (
        <div className="space-y-2 mb-4">
          {pattern.stocks.slice(0, 3).map((s, i) => (
            <Link
              key={s.code}
              href={`/screener/${s.code}`}
              className="flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2 hover:border-amber-400/30 hover:bg-amber-400/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[9px] text-slate-600 w-3">{i + 1}</span>
                <div>
                  <p className="text-[12px] font-medium text-slate-300 group-hover:text-[#e8f4ff] transition-colors leading-tight">{s.name}</p>
                  <p className="font-mono text-[9px] text-slate-600">{s.code} · {s.market}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[10px] text-slate-500">{pattern.keyLabel}</p>
                <p className="font-mono text-sm font-bold text-amber-400">{fmtMetric(s)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-slate-600 mb-4">現在、条件を満たす銘柄がありません</p>
      )}

      <Link
        href={pattern.screenerUrl}
        className="flex items-center justify-end gap-1 font-mono text-[10px] text-slate-500 hover:text-amber-400 transition-colors"
      >
        スクリーナーで全件表示
        <span className="inline-block translate-x-0 hover:translate-x-0.5 transition-transform">→</span>
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function SignalHubPage() {
  let signalTier: SignalData["signalTier"] = "NONE";
  let crs = 0;
  let athDd = 0;
  let date = "";
  let jpSignals: JpStockSignal[] = [];
  let signal: SignalData | null = null;
  let valuePatterns: ValuePattern[] = [];

  try {
    signal = await fetchSignal();
    signalTier = signal.signalTier;
    crs = signal.crs;
    athDd = signal.athDd;
    date = signal.date;
    jpSignals = signal.jpSignals;
  } catch { /* データ取得失敗時はカードをグレーアウト表示 */ }

  try {
    valuePatterns = await fetchValuePatterns();
  } catch { /* スクリーナーDB未接続時はセクションを非表示 */ }

  const sp500 = TIER_CONFIG[signalTier];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* ページヘッダー */}
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Signal Hub</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">買い場シグナル</h1>
          <p className="mt-1 text-sm text-slate-400">
            市場が暴落・恐怖状態になったとき、統計的に有利な買い場かどうかをリアルタイムで判定します。
          </p>
          {date && (
            <div className="mt-2 inline-flex items-center gap-2">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34d399]" />
              </span>
              <span className="font-mono text-[10px] text-slate-500">LIVE · {date} 取得 · 15分更新</span>
            </div>
          )}
        </div>

        {/* ━━━ シグナルとは（表形式） ━━━ */}
        <div className="mb-2 rounded-2xl border border-white/[0.12] bg-white/[0.03] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5">
            <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">シグナルとは</span>
            <span className="text-[10px] text-slate-500">— いつ、どんな条件で通知するか</span>
          </div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-600">状態</th>
                <th className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-600">意味</th>
                <th className="hidden sm:table-cell px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-600">参考リターン実績</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {[
                { badge: "超高品質", cls: "text-violet-300 border-violet-400/30 bg-violet-400/10", mean: "DCA比 +10〜14%", note: "phi2 + RSI<25 同時発動。30年で数回しかない稀なタイミング" },
                { badge: "発動中",   cls: "text-[#34d399] border-[#34d399]/30 bg-[#34d399]/10",   mean: "DCA比 +7.17%",   note: "phi2 v3シグナル。1993〜2024年 バックテスト中央値" },
                { badge: "補助発動", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10",   mean: "DCA比 +3.92%",   note: "RSI<25 単独。phi2より弱いが有意" },
                { badge: "待機中",   cls: "text-slate-400 border-white/20 bg-white/5",            mean: "—",              note: "通常相場。毎月積立を継続" },
              ].map((r) => (
                <tr key={r.badge}>
                  <td className="px-4 py-2.5">
                    <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9px] font-bold ${r.cls}`}>{r.badge}</span>
                  </td>
                  <td className="px-4 py-2.5 text-slate-400 leading-5">{r.note}</td>
                  <td className="hidden sm:table-cell px-4 py-2.5 font-mono text-[#34d399]">{r.mean}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 py-2 font-mono text-[9px] text-slate-600 border-t border-white/[0.04]">
            ※ 「DCA比+X%」は30年バックテスト中央値。個別の結果は異なります。投資助言ではありません。
            <Link href="/learn" className="ml-2 text-[#38bdf8]/60 hover:text-[#38bdf8] transition-colors">検証詳細 →</Link>
          </p>
        </div>

        {/* ━━━ S&P 500 ━━━ */}
        <SectionHeader
          title="S&P 500（米国株式市場の代表指数）"
          desc="アメリカの主要500社をまとめて保有できるインデックス。世界で最も流動性が高い投資対象。このサイトの主要シグナル対象。"
          accent="#38bdf8"
        />

        <Link href="/signal/sp500" className="block group">
          <div className={cardCls(sp500.border, sp500.glow)}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-base font-bold text-[#e8f4ff]">S&amp;P 500</p>
                  <span className="font-mono text-[10px] text-slate-500">^GSPC</span>
                </div>
                <p className="text-sm font-medium text-slate-300">{sp500.label}</p>
                {date && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
                    <div>
                      <p className="font-mono text-[9px] text-slate-500">
                        <Term tip="過去の最高値（All-Time High）からの現在の下落率。−10%なら最高値より10%安い状態。phi2シグナルはこれが−10%以下のときに注目する">ATH乖離</Term>
                      </p>
                      <FlickerNumber
                        value={pct(athDd)}
                        className={`font-mono text-sm font-bold ${athDd <= -0.15 ? "text-[#34d399]" : athDd <= -0.05 ? "text-amber-400" : "text-[#e8f4ff]"}`}
                      />
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-slate-500">
                        <Term tip="危機回復スコア（0〜6点）。VIX（恐怖指数）・HYG（社債）・ドル高など6指標で算出。高いほど市場が恐怖状態にある。phi2シグナルはスコア2以上で有効">CRS</Term>
                      </p>
                      <p className={`font-mono text-sm font-bold ${crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        <FlickerNumber value={String(crs)} delay={150} /><span className="text-slate-500 text-xs"> / 6</span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <span className={`rounded-full px-3 py-1 font-mono text-[11px] font-bold shrink-0 ${sp500.badgeCls}`}>
                {sp500.badge}
              </span>
            </div>
            <CardFooter />
          </div>
        </Link>

        {/* ━━━ 日本株（高配当） ━━━ */}
        <SectionHeader
          title="日本株（高配当）"
          desc="配当利回りが統計的に高い水準に達したときを「割安」と判定。NTT・JT・KDDI の3銘柄。26年分のデータで検証済み。"
          accent="#34d399"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { code: "9432", name: "NTT",  href: "/signal/ntt",  fullName: "日本電信電話" },
            { code: "2914", name: "JT",   href: "/signal/jt",   fullName: "日本たばこ産業" },
            { code: "9433", name: "KDDI", href: "/signal/kddi", fullName: "KDDI" },
          ].map(({ code, name, href, fullName }) => {
            const s = jpSignals.find((sig) => sig.code === code);
            const cfg = s ? JP_SIGNAL_CONFIG[s.signal] : JP_SIGNAL_CONFIG.HOLD;

            return (
              <Link key={code} href={href} className="block group">
                <div className={cardCls(cfg.cls, "")}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#e8f4ff]">{name}</p>
                      <p className="font-mono text-[10px] text-slate-500">{fullName} · {code}.T</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold shrink-0 ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {s ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-400">株価</span>
                        <span className="font-mono text-sm font-bold text-[#e8f4ff]">
                          ¥{s.price < 100 ? s.price.toFixed(1) : s.price.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-400">
                          <Term tip="株価に対して1年間にどれだけ配当をもらえるかの割合。3.5%なら100万円投資で年3.5万円の配当">配当利回り</Term>
                        </span>
                        <span className={`font-mono text-sm font-bold ${
                          s.divYield >= s.buyYield ? "text-[#34d399]"
                          : s.divYield <= s.sellYield ? "text-[#f87171]"
                          : "text-[#e8f4ff]"
                        }`}>
                          {(s.divYield * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-[11px] text-slate-400">
                          <Term tip="過去1年間の最安値〜最高値の範囲で、今の株価がどこにいるか。0%=1年最安値、100%=1年最高値。20%以下は底値圏">52週の位置</Term>
                        </span>
                        <span className={`font-mono text-sm font-bold ${
                          s.w52Pos <= 0.20 ? "text-[#34d399]"
                          : s.w52Pos >= 0.80 ? "text-[#f87171]"
                          : "text-[#e8f4ff]"
                        }`}>
                          {(s.w52Pos * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">データ取得中...</p>
                  )}

                  <CardFooter />
                </div>
              </Link>
            );
          })}
        </div>

        {/* ━━━ グローバル ETF ━━━ */}
        <SectionHeader
          title="グローバル ETF（米国以外への分散）"
          desc="先進国・新興国・全世界など、米国一極集中を避けたい場合の投資対象。SP500のシグナルと連動して判定。"
          accent="#a78bfa"
        />

        {/* EFA / EEM */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
          {[
            {
              ticker: "EFA", name: "先進国 ETF", href: "/signal/efa",
              athDdVal: signal?.efaAthDd ?? null, active: signal?.efaActive ?? false,
              desc: "日本・欧州・オーストラリアなど米国以外の先進国株をまとめて保有",
              threshold: "最高値から−10%以下",
            },
            {
              ticker: "EEM", name: "新興国 ETF", href: "/signal/eem",
              athDdVal: signal?.eemAthDd ?? null, active: signal?.eemActive ?? false,
              desc: "中国・韓国・台湾・インドなど新興国株。リスクは高いが成長期待も高い",
              threshold: "最高値から−10%以下",
            },
          ].map(({ ticker, name, href, athDdVal, active, desc, threshold }) => {
            const border = active ? "border-[#34d399]/40 bg-[#34d399]/[0.07]" : "border-white/[0.20] bg-white/[0.06]";
            const glow   = active ? "shadow-[0_0_16px_rgba(52,211,153,0.10)]" : "";
            const badge  = active ? "bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30" : "bg-white/[0.08] text-slate-400 border border-white/[0.15]";
            return (
              <Link key={ticker} href={href} className="block group">
                <div className={cardCls(border, glow)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#e8f4ff]">{name}</p>
                      <p className="font-mono text-[10px] text-slate-500">{ticker} · 発動条件: {threshold}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold shrink-0 ${badge}`}>
                      {active ? "発動中" : "待機中"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-400 mb-3">{desc}</p>
                  <div className="flex gap-5">
                    <div>
                      <p className="font-mono text-[9px] text-slate-500">
                        <Term tip="過去の最高値からの現在の下落率">ATH乖離</Term>
                      </p>
                      <p className={`font-mono text-sm font-bold ${athDdVal !== null && athDdVal <= -0.15 ? "text-[#34d399]" : athDdVal !== null && athDdVal <= -0.1 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {athDdVal !== null ? pct(athDdVal) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-slate-500">
                        <Term tip="危機回復スコア（SP500と同じ指標を共用）">CRS</Term>
                      </p>
                      <p className={`font-mono text-sm font-bold ${crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {crs}<span className="text-slate-500 text-xs"> / 6</span>
                      </p>
                    </div>
                  </div>
                  <CardFooter />
                </div>
              </Link>
            );
          })}
        </div>

        {/* QQQ / VT */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* ナスダック100 */}
          {(() => {
            const active   = signal?.qqqActive ?? false;
            const athDdVal = signal?.qqqAthDd ?? null;
            const border = active ? "border-[#34d399]/40 bg-[#34d399]/[0.07]" : "border-white/[0.20] bg-white/[0.06]";
            const glow   = active ? "shadow-[0_0_16px_rgba(52,211,153,0.10)]" : "";
            const badge  = active ? "bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30" : "bg-white/[0.08] text-slate-400 border border-white/[0.15]";
            return (
              <Link href="/signal/qqq" className="block group">
                <div className={cardCls(border, glow)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#e8f4ff]">ナスダック100</p>
                      <p className="font-mono text-[10px] text-slate-500">QQQ · 発動条件: 最高値から−18%以下</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${badge}`}>
                        {active ? "発動中" : "待機中"}
                      </span>
                      <span className="rounded border border-amber-400/25 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-[9px] text-amber-400">
                        ⚠ 弱シグナル
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-400 mb-3">
                    NVIDIA・Apple・Microsoft など米国テック100社。SP500より深い下落（−18%以上）でのみ有効。
                  </p>
                  <div className="flex gap-5">
                    <div>
                      <p className="font-mono text-[9px] text-slate-500"><Term tip="過去の最高値からの現在の下落率">ATH乖離</Term></p>
                      <p className={`font-mono text-sm font-bold ${athDdVal !== null && athDdVal <= -0.20 ? "text-[#34d399]" : athDdVal !== null && athDdVal <= -0.18 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {athDdVal !== null ? pct(athDdVal) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-slate-500"><Term tip="危機回復スコア（SP500と同じ指標を共用）">CRS</Term></p>
                      <p className={`font-mono text-sm font-bold ${crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {crs}<span className="text-slate-500 text-xs"> / 6</span>
                      </p>
                    </div>
                  </div>
                  <CardFooter />
                </div>
              </Link>
            );
          })()}

          {/* 全世界株（オルカン） */}
          {(() => {
            const active   = signal?.vtActive ?? false;
            const athDdVal = signal?.vtAthDd ?? null;
            const border = active ? "border-[#34d399]/40 bg-[#34d399]/[0.07]" : "border-white/[0.20] bg-white/[0.06]";
            const glow   = active ? "shadow-[0_0_16px_rgba(52,211,153,0.10)]" : "";
            const badge  = active ? "bg-[#34d399]/15 text-[#34d399] border border-[#34d399]/30" : "bg-white/[0.08] text-slate-400 border border-white/[0.15]";
            return (
              <Link href="/signal/vt" className="block group">
                <div className={cardCls(border, glow)}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-[#e8f4ff]">全世界株（オルカン）</p>
                      <p className="font-mono text-[10px] text-slate-500">VT · SP500 シグナルと連動</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold shrink-0 ${badge}`}>
                      {active ? "発動中" : "待機中"}
                    </span>
                  </div>
                  <p className="text-[11px] leading-5 text-slate-400 mb-3">
                    日本・米国・新興国を含む全世界の株式。SP500が発動したとき一緒に買う根拠として機能。独自シグナルではない。
                  </p>
                  <div className="flex gap-5">
                    <div>
                      <p className="font-mono text-[9px] text-slate-500"><Term tip="過去の最高値からの現在の下落率（参考値）">ATH乖離</Term></p>
                      <p className={`font-mono text-sm font-bold ${athDdVal !== null && athDdVal <= -0.15 ? "text-[#34d399]" : athDdVal !== null && athDdVal <= -0.1 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {athDdVal !== null ? pct(athDdVal) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[9px] text-slate-500"><Term tip="危機回復スコア（SP500と同じ指標を共用）">CRS</Term></p>
                      <p className={`font-mono text-sm font-bold ${crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"}`}>
                        {crs}<span className="text-slate-500 text-xs"> / 6</span>
                      </p>
                    </div>
                  </div>
                  <CardFooter />
                </div>
              </Link>
            );
          })()}
        </div>

        {/* ━━━ バリュー株レーダー ━━━ */}
        {valuePatterns.length > 0 && (
          <>
            <SectionHeader
              title="バリュー株レーダー（パターン別）"
              desc="財務指標が複数の割安条件を同時に満たす銘柄を、定義別に自動抽出。毎営業日夜に更新。"
              accent="#f59e0b"
            />
            <p className="mb-4 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] px-4 py-2.5 text-[11px] leading-5 text-slate-400">
              ⚠ これはスクリーニング結果です。SP500シグナルのような30年バックテストによる検証はなく、
              「この指標が良い株を並べた」にすぎません。個別株は市場全体より大きく下落するリスクがあります。
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {valuePatterns.map((pattern) => (
                <ValuePatternCard key={pattern.id} pattern={pattern} />
              ))}
            </div>
          </>
        )}

        <p className="mt-6 font-mono text-[10px] leading-6 text-slate-600">
          データ: Yahoo Finance (^GSPC · EFA · EEM · QQQ · VT · 9432.T · 2914.T · 9433.T)。15分キャッシュ。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
