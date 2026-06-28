import Link from "next/link";
import type { SignalData } from "@/lib/signal";

function pct(n: number, sign = true): string {
  const s = (n * 100).toFixed(2) + "%";
  return sign && n >= 0 ? "+" + s : s;
}

interface EtfConfig {
  ticker: string;
  displayName: string;
  tvSymbol: string;
  getAthDd: (s: SignalData) => number | null;
  getActive: (s: SignalData) => boolean;
  testZ: string | null;
  testNote: string;
  researchRound: string;
  description: string;
  athThrLabel?: string;   // default "ATH-10%"
  qualityNote?: string;   // extra note shown below main status (for 弱シグナル etc.)
  linkedTo?: string;      // "SP500 phi2 と連動" label for VT-style pages
}

interface Props {
  config: EtfConfig;
  signal: SignalData;
}

export default function EtfSignalPage({ config, signal }: Props) {
  const { ticker, displayName, tvSymbol, getAthDd, getActive, testZ, testNote, researchRound, description, athThrLabel = "ATH-10%", qualityNote, linkedTo } = config;
  const athDd  = getAthDd(signal);
  const active = getActive(signal);
  const { crs, date } = signal;

  const tvSrc = `https://www.tradingview.com/widgetembed/?symbol=${encodeURIComponent(tvSymbol)}&interval=W&theme=Dark&style=1&locale=ja&timezone=America%2FNew_York&hide_side_toolbar=0`;

  const statusBorder = active
    ? "border-[#34d399]/40 bg-[#34d399]/[0.08]"
    : "border-white/[0.15] bg-white/[0.11]";

  const conclusion = active
    ? { text: `⚡ ${displayName} シグナル発動中。${testNote}`, cls: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" }
    : crs < 2
    ? { text: "待機中。CRS が低く条件未達。定期積立（DCA）を継続。", cls: "border-white/[0.13] bg-white/[0.11] text-slate-400" }
    : athDd !== null && athDd > -0.1
    ? { text: `待機中。ATH乖離 ${pct(athDd)} — まだ発動圏（−10%）に達していない。`, cls: "border-white/[0.13] bg-white/[0.11] text-slate-400" }
    : { text: "発動圏内に入っています。当日リターン・vol などの条件待ち。", cls: "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/signal" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← シグナル一覧にもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">{ticker} / グローバル ETF</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">{displayName} シグナル状態</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-400">{date} · 15分キャッシュ · Yahoo Finance {ticker}</p>
        </div>

        {/* 今日の結論 */}
        <div className={`mt-5 rounded-2xl border px-5 py-4 backdrop-blur-sm ${conclusion.cls}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1.5 text-slate-400">今日の結論</p>
          <p className="text-base font-semibold leading-snug">{conclusion.text}</p>
        </div>

        {/* メインステータス */}
        <div className={`mt-4 rounded-2xl border p-5 backdrop-blur-sm ${statusBorder}`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">シグナル状態</p>
          <div className="flex items-center gap-3 mb-3">
            <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-[#34d399]" : "bg-white/30"}`} />
            <p className={`text-xl font-semibold ${active ? "text-[#34d399]" : "text-white/50"}`}>
              {active ? "phi2 条件 発動中" : "待機中"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[9px] text-slate-500">ATH 乖離</p>
              <p className={`mt-1 font-mono text-base font-semibold ${
                athDd !== null && athDd <= -0.15 ? "text-[#34d399]"
                : athDd !== null && athDd <= -0.1 ? "text-amber-400"
                : "text-slate-300"
              }`}>
                {athDd !== null ? pct(athDd) : "—"}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[9px] text-slate-500">CRS（SP500 共用）</p>
              <p className={`mt-1 font-mono text-base font-semibold ${
                crs >= 5 ? "text-violet-300" : crs >= 2 ? "text-amber-400" : "text-slate-400"
              }`}>
                {crs} / 6
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.15] bg-white/[0.02] px-3 py-2.5">
              <p className="font-mono text-[9px] text-slate-500">発動条件</p>
              <p className="mt-1 font-mono text-[10px] text-slate-400 leading-4">
                {athThrLabel} + 当日-2%<br />+ vol&gt;25% + CRS≥2
              </p>
            </div>
          </div>
          {linkedTo && (
            <p className="mt-2 font-mono text-[10px] text-[#38bdf8]/70">{linkedTo}</p>
          )}
          {qualityNote && (
            <p className="mt-2 font-mono text-[10px] text-amber-400/80">{qualityNote}</p>
          )}
        </div>

        {/* TradingView チャート */}
        <div className="mt-4 rounded-2xl border border-white/[0.18] overflow-hidden bg-white/[0.02]">
          <p className="px-4 pt-3 font-mono text-[9px] uppercase tracking-widest text-slate-500">株価チャート（週足）</p>
          <iframe src={tvSrc} className="w-full" style={{ height: 360, display: "block" }} allowFullScreen />
        </div>

        {/* 検証根拠 */}
        <div className="mt-4 rounded-2xl border border-white/[0.22] bg-white/[0.11] p-5 backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">{researchRound} 検証根拠</p>
          <p className="text-sm leading-6 text-slate-300">{description}</p>
          {testZ && (
            <div className="mt-3 flex items-center gap-3">
              <span className="font-mono text-[10px] text-slate-500">TEST Z =</span>
              <span className="font-mono text-lg font-bold text-[#34d399]">+{testZ}</span>
              <span className="font-mono text-[10px] text-slate-500">（バックテスト 1993–2024）</span>
            </div>
          )}
        </div>

        {/* CRS の意味 */}
        <div className="mt-3 rounded-2xl border border-white/[0.18] bg-white/[0.11] p-4">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">CRS とは</p>
          <p className="text-xs leading-5 text-slate-400">
            CRS（Crisis Recovery Score）は SP500 ベースで計算される危機の深さスコア（0〜6点）。
            VIX&gt;30 / HYG 急落 / DXY 上昇 / 急落直後 / HYG 高値-8% / RSP 弱化 の 6 成分。
            EFA・EEM はグローバル ETF だが、CRS は米国指標で構築されているため SP500 シグナルと共用する。
            Round 42 で検証: 米国 CRS がグローバル危機も正しく検知できることを確認。
          </p>
          <Link href="/signal/sp500" className="mt-2 inline-block font-mono text-[10px] text-[#38bdf8] hover:opacity-80 transition-opacity">
            SP500 ページで CRS 詳細を確認 →
          </Link>
        </div>

        <p className="mt-6 font-mono text-[10px] leading-6 text-slate-500">
          データ: Yahoo Finance ({ticker})。15分キャッシュ。これは投資助言ではありません。
          {testZ && ` TEST Z=+${testZ} (${researchRound})。`}
        </p>
      </main>
    </div>
  );
}
