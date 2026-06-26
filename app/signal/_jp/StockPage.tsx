import Link from "next/link";
import { fetchJpStockSignals, JP_STOCKS } from "@/lib/jp-stock-signal";
import type { JpStockSignal } from "@/lib/jp-stock-signal";
import JpIrCalendar from "@/app/components/JpIrCalendar";
import StockNews from "@/app/components/NttNews";

function W52Bar({ pos }: { pos: number }) {
  const pct = Math.round(pos * 100);
  return (
    <div className="mt-1">
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.08]">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${
            pos <= 0.20 ? "bg-[#34d399]" : pos >= 0.80 ? "bg-[#f87171]" : "bg-slate-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
        <span>52週安値</span>
        <span>52週高値</span>
      </div>
    </div>
  );
}

const STOCK_EXTRA: Record<string, { market: string; sector: string; description: string }> = {
  "9432": {
    market: "東証プライム",
    sector: "通信",
    description: "日本最大の通信グループ。NTTドコモ・NTT東西・NTTデータを傘下に持つ。2023年に25:1株式分割を実施。安定配当銘柄として知られる。",
  },
  "2914": {
    market: "東証プライム",
    sector: "食品・たばこ",
    description: "日本たばこ産業。国内たばこシェア約6割。海外事業（RJR・Gallaher等）が売上の半数超。高配当維持の方針を継続している。",
  },
  "9433": {
    market: "東証プライム",
    sector: "通信",
    description: "au（携帯電話）・KDDI光・auじぶん銀行等を運営。連続増配25年超。通信・金融・エネルギーの多角化で安定した収益基盤を持つ。",
  },
};

export default async function JpStockPage({ code }: { code: string }) {
  const cfg = JP_STOCKS.find((s) => s.code === code);
  if (!cfg) return <div className="p-8 text-red-400">銘柄が見つかりません</div>;

  const signals = await fetchJpStockSignals().catch(() => [] as JpStockSignal[]);
  const s = signals.find((sig) => sig.code === code);

  const extra = STOCK_EXTRA[code];
  const ticker = `${code}.T`;
  const stockName = cfg.name as "NTT" | "JT" | "KDDI";

  const signalLabel =
    s?.signal === "BUY"  ? "割安" :
    s?.signal === "SELL" ? "割高" : "中立";

  const signalCls =
    s?.signal === "BUY"  ? "border-[#34d399]/40 bg-[#34d399]/[0.08] text-[#34d399]" :
    s?.signal === "SELL" ? "border-[#f87171]/40 bg-[#f87171]/[0.08] text-[#f87171]" :
    "border-white/[0.15] bg-white/[0.06] text-slate-400";

  const conclusionText = (() => {
    if (!s) return "データ取得中 — しばらくしてから再読み込みしてください。";
    if (s.signal === "BUY")
      return `配当利回り ${(s.divYield * 100).toFixed(2)}% は買いゾーン（≥${(cfg.buyYield * 100).toFixed(1)}%）。52週レンジ下位 ${(s.w52Pos * 100).toFixed(0)}% で価格も低い水準。過去統計で優位性あり（Z=1.88）。`;
    if (s.signal === "SELL")
      return `配当利回り ${(s.divYield * 100).toFixed(2)}% は割高水準（≤${(cfg.sellYield * 100).toFixed(1)}%）または52週高値圏。追加投入は非推奨。`;
    return `配当利回り ${s ? (s.divYield * 100).toFixed(2) + "%" : "—"} は中立ゾーン。買い条件・売り条件ともに未達。定期積立継続で問題なし。`;
  })();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/signal" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← シグナル一覧にもどる
        </Link>

        {/* ヘッダー */}
        <div className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">
                {extra?.market ?? "東証"} · {extra?.sector ?? "—"}
              </p>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">
                {cfg.name} <span className="text-slate-500 text-lg font-normal">— {cfg.fullName}</span>
              </h1>
              <p className="mt-1 font-mono text-[10px] text-slate-400">
                {ticker} · 年間配当 ¥{cfg.annualDiv}/株 · 15分キャッシュ
              </p>
            </div>
            <span className={`shrink-0 rounded-2xl border px-4 py-2 font-mono text-sm font-bold ${signalCls}`}>
              {signalLabel}
            </span>
          </div>
          {extra && (
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{extra.description}</p>
          )}
        </div>

        {/* 今日の結論 */}
        <div className={`mt-5 rounded-2xl border px-5 py-4 backdrop-blur-sm ${signalCls}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1.5 text-slate-400">今日の判定</p>
          <p className="text-base font-semibold leading-snug">{conclusionText}</p>
        </div>

        {/* 指標カード */}
        {s ? (
          <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.06] p-5 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-4">現在の指標</p>

            <div className="grid grid-cols-3 gap-4 mb-5">
              <div>
                <p className="font-mono text-[9px] text-slate-500 mb-1">株価</p>
                <p className="font-mono text-2xl font-bold text-[#e8f4ff]">
                  ¥{s.price < 100 ? s.price.toFixed(1) : s.price.toFixed(0)}
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] text-slate-500 mb-1">配当利回り</p>
                <p className={`font-mono text-2xl font-bold ${
                  s.divYield >= cfg.buyYield ? "text-[#34d399]"
                  : s.divYield <= cfg.sellYield ? "text-[#f87171]"
                  : "text-[#e8f4ff]"
                }`}>
                  {(s.divYield * 100).toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="font-mono text-[9px] text-slate-500 mb-1">52週位置</p>
                <p className={`font-mono text-2xl font-bold ${
                  s.w52Pos <= 0.20 ? "text-[#34d399]"
                  : s.w52Pos >= 0.80 ? "text-[#f87171]"
                  : "text-[#e8f4ff]"
                }`}>
                  {(s.w52Pos * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* 52週レンジバー */}
            <div className="mb-5">
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-slate-500">52週レンジ</span>
                <span className="font-mono text-[9px] text-slate-400">
                  ¥{s.w52Lo.toFixed(0)} 〜 ¥{s.w52Hi.toFixed(0)}
                </span>
              </div>
              <W52Bar pos={s.w52Pos} />
            </div>

            {/* BUY条件チェック */}
            <div className="border-t border-white/[0.08] pt-4">
              <p className="font-mono text-[9px] text-slate-500 mb-2">BUY 条件チェック</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${s.divYield >= cfg.buyYield ? "text-[#34d399]" : "text-slate-600"}`}>
                    {s.divYield >= cfg.buyYield ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${s.divYield >= cfg.buyYield ? "text-slate-300" : "text-slate-600"}`}>
                    配当利回り ≥ {(cfg.buyYield * 100).toFixed(1)}%
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      （現在 {(s.divYield * 100).toFixed(2)}%）
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${s.w52Pos <= 0.20 ? "text-[#34d399]" : "text-slate-600"}`}>
                    {s.w52Pos <= 0.20 ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${s.w52Pos <= 0.20 ? "text-slate-300" : "text-slate-600"}`}>
                    52週レンジ下位 20%
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      （現在 {(s.w52Pos * 100).toFixed(0)}%）
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 利回り閾値ガイド */}
            <div className="mt-4 border-t border-white/[0.08] pt-4">
              <p className="font-mono text-[9px] text-slate-500 mb-2">利回りゾーン</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "割安（BUY）",   range: `≥ ${(cfg.buyYield * 100).toFixed(1)}%`,  cls: "border-[#34d399]/30 text-[#34d399]",  active: s.divYield >= cfg.buyYield },
                  { label: "中立（HOLD）",  range: `${(cfg.sellYield * 100).toFixed(1)}〜${(cfg.buyYield * 100).toFixed(1)}%`, cls: "border-slate-500/30 text-slate-400", active: s.divYield > cfg.sellYield && s.divYield < cfg.buyYield },
                  { label: "割高（SELL）",  range: `≤ ${(cfg.sellYield * 100).toFixed(1)}%`,  cls: "border-[#f87171]/30 text-[#f87171]", active: s.divYield <= cfg.sellYield },
                ].map((z) => (
                  <div key={z.label} className={`rounded-xl border px-3 py-2 text-center ${z.cls} ${z.active ? "opacity-100 bg-white/[0.04]" : "opacity-30"}`}>
                    <p className="font-mono text-[9px]">{z.label}</p>
                    <p className="font-mono text-xs font-bold mt-0.5">{z.range}</p>
                    {z.active && <p className="font-mono text-[9px] mt-0.5">← 現在</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-5">
            <p className="text-xs text-slate-500">株価データを取得できませんでした。市場時間外または一時的なエラーです。</p>
          </div>
        )}

        {/* シグナル根拠 */}
        <div className="mt-4 rounded-2xl border border-white/[0.10] bg-white/[0.03] p-5">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">シグナルの根拠</p>
          <div className="space-y-2 text-xs leading-5 text-slate-400">
            <p>
              <span className="text-slate-300 font-medium">配当利回りベースのバリュエーション判断。</span>
              株価が下がれば利回りが上がり「割安」、株価が上がれば利回りが下がり「割高」と判断する。
              高配当株特有の逆張りシグナル（decisions/0033）。
            </p>
            <p>
              <span className="font-mono text-slate-300">Z = 1.88 · n = 20 · 26年統計（1998〜2024）</span>
              — 買い条件充足後30日の超過リターン検定。有意水準5%（片側）を上回る。
            </p>
            <p className="text-slate-600">
              過剰落ち仮説（権利落ち日後のアルファ）は Round 44-45 で棄却済み（decisions/0032）。
              現シグナルは純粋な利回りバリュエーションのみに基づく。
            </p>
          </div>
        </div>

        {/* IR カレンダー */}
        <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.09] p-4 backdrop-blur-md">
          <JpIrCalendar stock={stockName} />
        </div>

        {/* ニュース */}
        <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.09] p-4 backdrop-blur-md">
          <StockNews ticker={ticker} label={`${cfg.name} 関連ニュース`} />
        </div>

        <p className="mt-6 font-mono text-[10px] leading-6 text-slate-600">
          データ: Yahoo Finance ({ticker})。配当利回りシグナル: Z=1.88, n=20, 26年統計 (decisions/0033)。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
