import type { Metadata } from "next";
import Link from "next/link";
import { fetchSignal } from "@/lib/signal";
import type { SignalData } from "@/lib/signal";
import type { JpStockSignal } from "@/lib/jp-stock-signal";

export const metadata: Metadata = {
  title: "買い場シグナル一覧 — S&P500・ETF・日本株 リアルタイム",
  description: "S&P500・EFA・EEM・QQQ・VT・NTT・JT・KDDI の買い場シグナル発動状態をリアルタイム表示。phi2 v3・CRS スコア・RSI<25 など5本のシグナル体制。",
};

export const revalidate = 900;

function pct(n: number, sign = true): string {
  const s = (n * 100).toFixed(2) + "%";
  return sign && n >= 0 ? "+" + s : s;
}

const TIER_CONFIG: Record<
  SignalData["signalTier"],
  { label: string; badge: string; badgeCls: string; border: string }
> = {
  DOUBLE: {
    label: "phi2 + RSI<25 同時発動",
    badge: "超高品質",
    badgeCls: "bg-violet-400/15 text-violet-300",
    border: "border-violet-400/40 bg-violet-400/[0.07]",
  },
  PHI2: {
    label: "phi2 v3 発動中",
    badge: "発動",
    badgeCls: "bg-[#34d399]/15 text-[#34d399]",
    border: "border-[#34d399]/40 bg-[#34d399]/[0.07]",
  },
  RSI25: {
    label: "RSI<25 発動（低信頼度）",
    badge: "補助",
    badgeCls: "bg-amber-400/15 text-amber-400",
    border: "border-amber-400/30 bg-amber-400/[0.05]",
  },
  NEAR: {
    label: "発動圏内 — 条件待ち",
    badge: "圏内",
    badgeCls: "bg-amber-400/10 text-amber-400/70",
    border: "border-amber-400/20 bg-amber-400/[0.03]",
  },
  NONE: {
    label: "待機中",
    badge: "待機",
    badgeCls: "bg-white/[0.11] text-slate-400",
    border: "border-white/[0.22] bg-white/[0.14]",
  },
};

const JP_SIGNAL_CONFIG = {
  BUY:  { label: "割安", cls: "border-[#34d399]/40 bg-[#34d399]/[0.07] text-[#34d399]", badge: "bg-[#34d399]/15 text-[#34d399]" },
  HOLD: { label: "中立", cls: "border-white/[0.22] bg-white/[0.14] text-slate-400",      badge: "bg-white/[0.11] text-slate-400" },
  SELL: { label: "割高", cls: "border-[#f87171]/40 bg-[#f87171]/[0.07] text-[#f87171]", badge: "bg-[#f87171]/15 text-[#f87171]" },
};

export default async function SignalHubPage() {
  let signalTier: SignalData["signalTier"] = "NONE";
  let crs = 0;
  let athDd = 0;
  let date = "";
  let jpSignals: JpStockSignal[] = [];
  let signal: SignalData | null = null;

  try {
    signal = await fetchSignal();
    signalTier = signal.signalTier;
    crs = signal.crs;
    athDd = signal.athDd;
    date = signal.date;
    jpSignals = signal.jpSignals;
  } catch {
    // データ取得失敗時はカードをグレーアウト表示
  }

  const sp500 = TIER_CONFIG[signalTier];

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Signal Hub</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">シグナル一覧</h1>
          {date && (
            <p className="mt-1 font-mono text-[10px] text-slate-400">{date} · 15分キャッシュ</p>
          )}
        </div>

        {/* ━━━ S&P 500 ━━━ */}
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">S&amp;P 500</span>
          <span className="flex-1 border-t border-white/[0.15]" />
          <span className="font-mono text-[9px] text-slate-500">phi2 v3 · CRS · RSI · HYG · B4 · EFA</span>
        </div>

        <Link href="/signal/sp500" className="block group">
          <div className={`rounded-2xl border p-5 backdrop-blur-sm transition-all group-hover:brightness-110 ${sp500.border}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-mono text-xs font-bold text-[#e8f4ff]">S&amp;P 500</p>
                  <span className="font-mono text-[9px] text-slate-500">^GSPC</span>
                </div>
                <p className="text-sm font-medium text-slate-300">{sp500.label}</p>
                {date && (
                  <p className="mt-2 font-mono text-[10px] text-slate-500">
                    ATH乖離 {pct(athDd)} · CRS {crs}/6
                  </p>
                )}
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`rounded-full px-2.5 py-1 font-mono text-[10px] font-bold ${sp500.badgeCls}`}>
                  {sp500.badge}
                </span>
                <span className="font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors">
                  詳細 →
                </span>
              </div>
            </div>
          </div>
        </Link>

        {/* ━━━ 日本株（高配当） ━━━ */}
        <div className="mt-8 mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">日本株（高配当）</span>
          <span className="flex-1 border-t border-white/[0.15]" />
          <span className="font-mono text-[9px] text-slate-500">配当利回り · 52週レンジ · decisions/0033</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { code: "9432", name: "NTT",  href: "/signal/ntt"  },
            { code: "2914", name: "JT",   href: "/signal/jt"   },
            { code: "9433", name: "KDDI", href: "/signal/kddi" },
          ].map(({ code, name, href }) => {
            const s = jpSignals.find((sig) => sig.code === code);
            const cfg = s ? JP_SIGNAL_CONFIG[s.signal] : JP_SIGNAL_CONFIG.HOLD;

            return (
              <Link key={code} href={href} className="block group">
                <div className={`rounded-2xl border p-4 backdrop-blur-sm transition-all group-hover:brightness-110 ${cfg.cls}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#e8f4ff]">{name}</p>
                      <p className="font-mono text-[9px] text-slate-500">{code}.T</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {s ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="font-mono text-[9px] text-slate-500">株価</span>
                        <span className="font-mono text-xs font-bold text-[#e8f4ff]">
                          ¥{s.price < 100 ? s.price.toFixed(1) : s.price.toFixed(0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-[9px] text-slate-500">配当利回り</span>
                        <span className={`font-mono text-xs font-bold ${
                          s.divYield >= s.buyYield ? "text-[#34d399]"
                          : s.divYield <= s.sellYield ? "text-[#f87171]"
                          : "text-[#e8f4ff]"
                        }`}>
                          {(s.divYield * 100).toFixed(2)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-mono text-[9px] text-slate-500">52週位置</span>
                        <span className={`font-mono text-xs font-bold ${
                          s.w52Pos <= 0.20 ? "text-[#34d399]"
                          : s.w52Pos >= 0.80 ? "text-[#f87171]"
                          : "text-[#e8f4ff]"
                        }`}>
                          {(s.w52Pos * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="font-mono text-[9px] text-slate-500">データ取得中...</p>
                  )}

                  <p className="mt-3 font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors text-right">
                    詳細 →
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ━━━ グローバル ETF ━━━ */}
        <div className="mt-8 mb-3 flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">グローバル ETF</span>
          <span className="flex-1 border-t border-white/[0.15]" />
          <span className="font-mono text-[9px] text-slate-500">phi2条件 · CRS共用 · Round 42/48/49</span>
        </div>

        {/* EFA / EEM — 既存 (Round 42) */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            {
              ticker: "EFA", name: "先進国 ETF", href: "/signal/efa",
              athDdVal: signal?.efaAthDd ?? null, active: signal?.efaActive ?? false,
              note: "日本・欧州・豪州など · TEST Z=+8.08",
              athThrLabel: "-10%",
            },
            {
              ticker: "EEM", name: "新興国 ETF", href: "/signal/eem",
              athDdVal: signal?.eemAthDd ?? null, active: signal?.eemActive ?? false,
              note: "中国・韓国・台湾・インドなど",
              athThrLabel: "-10%",
            },
          ].map(({ ticker, name, href, athDdVal, active, note, athThrLabel }) => {
            const border = active
              ? "border-[#34d399]/40 bg-[#34d399]/[0.07]"
              : "border-white/[0.22] bg-white/[0.14]";
            const badge = active
              ? "bg-[#34d399]/15 text-[#34d399]"
              : "bg-white/[0.11] text-slate-400";
            return (
              <Link key={ticker} href={href} className="block group">
                <div className={`rounded-2xl border p-4 backdrop-blur-sm transition-all group-hover:brightness-110 ${border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#e8f4ff]">{name}</p>
                      <p className="font-mono text-[9px] text-slate-500">{ticker} · 閾値 {athThrLabel}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${badge}`}>
                      {active ? "発動中" : "待機"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">ATH 乖離</span>
                      <span className={`font-mono text-xs font-bold ${
                        athDdVal !== null && athDdVal <= -0.15 ? "text-[#34d399]"
                        : athDdVal !== null && athDdVal <= -0.1 ? "text-amber-400"
                        : "text-[#e8f4ff]"
                      }`}>
                        {athDdVal !== null ? (athDdVal >= 0 ? "+" : "") + (athDdVal * 100).toFixed(2) + "%" : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">CRS（SP500共用）</span>
                      <span className={`font-mono text-xs font-bold ${
                        crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"
                      }`}>{crs}/6</span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mt-1">{note}</p>
                  </div>
                  <p className="mt-3 font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors text-right">
                    詳細 →
                  </p>
                </div>
              </Link>
            );
          })}
        </div>

        {/* QQQ / VT — Round 48/49 */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">

          {/* ナスダック100 (QQQ) — Round 48 */}
          {(() => {
            const active = signal?.qqqActive ?? false;
            const athDdVal = signal?.qqqAthDd ?? null;
            const border = active
              ? "border-[#34d399]/40 bg-[#34d399]/[0.07]"
              : "border-white/[0.22] bg-white/[0.14]";
            const badge = active
              ? "bg-[#34d399]/15 text-[#34d399]"
              : "bg-white/[0.11] text-slate-400";
            return (
              <Link href="/signal/qqq" className="block group">
                <div className={`rounded-2xl border p-4 backdrop-blur-sm transition-all group-hover:brightness-110 ${border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#e8f4ff]">ナスダック100</p>
                      <p className="font-mono text-[9px] text-slate-500">QQQ · 閾値 -18%</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${badge}`}>
                        {active ? "発動中" : "待機"}
                      </span>
                      <span className="rounded border border-amber-400/25 bg-amber-400/[0.06] px-1.5 py-0.5 font-mono text-[8px] text-amber-400">
                        弱シグナル
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">ATH 乖離</span>
                      <span className={`font-mono text-xs font-bold ${
                        athDdVal !== null && athDdVal <= -0.20 ? "text-[#34d399]"
                        : athDdVal !== null && athDdVal <= -0.18 ? "text-amber-400"
                        : "text-[#e8f4ff]"
                      }`}>
                        {athDdVal !== null ? (athDdVal >= 0 ? "+" : "") + (athDdVal * 100).toFixed(2) + "%" : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">CRS（SP500共用）</span>
                      <span className={`font-mono text-xs font-bold ${
                        crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"
                      }`}>{crs}/6</span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mt-1">
                      TEST Z=+6.77, +17.8% · ATH-18%以上の深い調整のみ有効
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors text-right">詳細 →</p>
                </div>
              </Link>
            );
          })()}

          {/* 全世界株 / オルカン (VT) — Round 49 */}
          {(() => {
            const active = signal?.vtActive ?? false;
            const athDdVal = signal?.vtAthDd ?? null;
            const border = active
              ? "border-[#34d399]/40 bg-[#34d399]/[0.07]"
              : "border-white/[0.22] bg-white/[0.14]";
            const badge = active
              ? "bg-[#34d399]/15 text-[#34d399]"
              : "bg-white/[0.11] text-slate-400";
            return (
              <Link href="/signal/vt" className="block group">
                <div className={`rounded-2xl border p-4 backdrop-blur-sm transition-all group-hover:brightness-110 ${border}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-mono text-xs font-bold text-[#e8f4ff]">全世界株（オルカン）</p>
                      <p className="font-mono text-[9px] text-slate-500">VT · SP500 phi2 連動</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${badge}`}>
                      {active ? "発動中" : "待機"}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">ATH 乖離（参考）</span>
                      <span className={`font-mono text-xs font-bold ${
                        athDdVal !== null && athDdVal <= -0.15 ? "text-[#34d399]"
                        : athDdVal !== null && athDdVal <= -0.1 ? "text-amber-400"
                        : "text-[#e8f4ff]"
                      }`}>
                        {athDdVal !== null ? (athDdVal >= 0 ? "+" : "") + (athDdVal * 100).toFixed(2) + "%" : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-mono text-[9px] text-slate-500">CRS（SP500共用）</span>
                      <span className={`font-mono text-xs font-bold ${
                        crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-[#e8f4ff]"
                      }`}>{crs}/6</span>
                    </div>
                    <p className="font-mono text-[9px] text-slate-500 mt-1">
                      合成オルカン TEST Z=+7.21 · SP500 phi2 発動時に同時購入推奨
                    </p>
                  </div>
                  <p className="mt-3 font-mono text-[9px] text-slate-500 group-hover:text-slate-400 transition-colors text-right">詳細 →</p>
                </div>
              </Link>
            );
          })()}
        </div>

        {/* 使い方ガイド */}
        <div className="mt-8 rounded-2xl border border-white/[0.15] bg-white/[0.02] px-5 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] text-slate-500 mb-3">このページの見かた</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              { num: "01", text: "S&P 500 は phi2 v3 等のシグナル体制。30年バックテスト済み。発動時に通知が届く" },
              { num: "02", text: "日本株（高配当）は配当利回りによる割安・割高判定。Z=1.88、26年統計" },
              { num: "03", text: "ナスダック100は「弱シグナル」表示あり。ATH-18%以上の深い調整でのみ統計的に有意（R48）" },
              { num: "04", text: "全世界株（オルカン）は SP500 phi2 と連動。独立シグナルではなく「同時購入の根拠」として機能（R49）" },
            ].map((c) => (
              <div key={c.num} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
                <span className="font-mono text-sm font-bold text-white/[0.08] shrink-0">{c.num}</span>
                <p className="text-[11px] leading-5 text-slate-500">{c.text}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-6 font-mono text-[10px] leading-6 text-slate-500">
          データ: Yahoo Finance (^GSPC · EFA · EEM · QQQ · VT · 9432.T · 2914.T · 9433.T)。15分キャッシュ。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
