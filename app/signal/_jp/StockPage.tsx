import Link from "next/link";
import { fetchJpStockSignals, JP_STOCKS, fetchYieldStats } from "@/lib/jp-stock-signal";
import type { JpStockSignal, YieldStats } from "@/lib/jp-stock-signal";
import JpIrCalendar from "@/app/components/JpIrCalendar";
import StockNews from "@/app/components/NttNews";

function W52Bar({ pos }: { pos: number }) {
  const pct = Math.round(pos * 100);
  return (
    <div className="mt-1">
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.14]">
        <div
          className={`absolute left-0 top-0 h-full rounded-full ${
            pos <= 0.20 ? "bg-[#34d399]" : pos >= 0.80 ? "bg-[#f87171]" : "bg-slate-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-500">
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

  const [signals, yieldStats] = await Promise.all([
    fetchJpStockSignals().catch(() => [] as JpStockSignal[]),
    fetchYieldStats(cfg).catch(() => null as YieldStats | null),
  ]);
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
    "border-white/[0.15] bg-white/[0.11] text-slate-400";

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
          <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5 backdrop-blur-md">
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
            <div className="border-t border-white/[0.15] pt-4">
              <p className="font-mono text-[9px] text-slate-500 mb-2">BUY 条件チェック</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${s.divYield >= cfg.buyYield ? "text-[#34d399]" : "text-slate-500"}`}>
                    {s.divYield >= cfg.buyYield ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${s.divYield >= cfg.buyYield ? "text-slate-300" : "text-slate-500"}`}>
                    配当利回り ≥ {(cfg.buyYield * 100).toFixed(1)}%
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      （現在 {(s.divYield * 100).toFixed(2)}%）
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-sm ${s.w52Pos <= 0.20 ? "text-[#34d399]" : "text-slate-500"}`}>
                    {s.w52Pos <= 0.20 ? "✓" : "○"}
                  </span>
                  <span className={`text-xs ${s.w52Pos <= 0.20 ? "text-slate-300" : "text-slate-500"}`}>
                    52週レンジ下位 20%
                    <span className="ml-2 font-mono text-[10px] text-slate-500">
                      （現在 {(s.w52Pos * 100).toFixed(0)}%）
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* 利回り閾値ガイド */}
            <div className="mt-4 border-t border-white/[0.15] pt-4">
              <p className="font-mono text-[9px] text-slate-500 mb-2">利回りゾーン</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "割安（BUY）",   range: `≥ ${(cfg.buyYield * 100).toFixed(1)}%`,  cls: "border-[#34d399]/30 text-[#34d399]",  active: s.divYield >= cfg.buyYield },
                  { label: "中立（HOLD）",  range: `${(cfg.sellYield * 100).toFixed(1)}〜${(cfg.buyYield * 100).toFixed(1)}%`, cls: "border-slate-500/30 text-slate-400", active: s.divYield > cfg.sellYield && s.divYield < cfg.buyYield },
                  { label: "割高（SELL）",  range: `≤ ${(cfg.sellYield * 100).toFixed(1)}%`,  cls: "border-[#f87171]/30 text-[#f87171]", active: s.divYield <= cfg.sellYield },
                ].map((z) => (
                  <div key={z.label} className={`rounded-xl border px-3 py-2 text-center ${z.cls} ${z.active ? "opacity-100 bg-white/[0.14]" : "opacity-30"}`}>
                    <p className="font-mono text-[9px]">{z.label}</p>
                    <p className="font-mono text-xs font-bold mt-0.5">{z.range}</p>
                    {z.active && <p className="font-mono text-[9px] mt-0.5">← 現在</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.14] p-5">
            <p className="text-xs text-slate-500">株価データを取得できませんでした。市場時間外または一時的なエラーです。</p>
          </div>
        )}

        {/* 利回り分布統計（5年） */}
        {yieldStats && s && (
          <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-4">
              利回り分布（過去5年 · {yieldStats.totalDays}営業日）
            </p>

            {/* 分布ゲージ */}
            {(() => {
              const lo  = yieldStats.yieldMin;
              const hi  = yieldStats.yieldMax;
              const range = hi - lo;
              const pos  = (cur: number) => Math.max(0, Math.min(100, ((cur - lo) / range) * 100));

              const sellPos = pos(cfg.sellYield);
              const buyPos  = pos(cfg.buyYield);
              const curPos  = pos(s.divYield);

              return (
                <div className="mb-5">
                  <div className="relative h-5 w-full rounded-full overflow-hidden bg-white/[0.06]">
                    {/* 割高ゾーン（赤） */}
                    <div className="absolute top-0 left-0 h-full bg-[#f87171]/20 rounded-l-full" style={{ width: `${sellPos}%` }} />
                    {/* 割安ゾーン（緑） */}
                    <div className="absolute top-0 h-full bg-[#34d399]/20 rounded-r-full" style={{ left: `${buyPos}%`, width: `${100 - buyPos}%` }} />
                    {/* SELL閾値線 */}
                    <div className="absolute top-0 h-full w-px bg-[#f87171]/50" style={{ left: `${sellPos}%` }} />
                    {/* BUY閾値線 */}
                    <div className="absolute top-0 h-full w-px bg-[#34d399]/50" style={{ left: `${buyPos}%` }} />
                    {/* 中央値マーク */}
                    <div className="absolute top-0 h-full w-px bg-white/20" style={{ left: `${pos(yieldStats.yieldMedian)}%` }} />
                    {/* 現在地マーカー */}
                    <div
                      className="absolute top-0 h-full w-1 rounded-full"
                      style={{
                        left: `${curPos}%`,
                        transform: "translateX(-50%)",
                        background: s.divYield >= cfg.buyYield ? "#34d399" : s.divYield <= cfg.sellYield ? "#f87171" : "#e8f4ff",
                        boxShadow: `0 0 8px ${s.divYield >= cfg.buyYield ? "rgba(52,211,153,0.6)" : s.divYield <= cfg.sellYield ? "rgba(248,113,113,0.6)" : "rgba(232,244,255,0.4)"}`,
                      }}
                    />
                  </div>
                  {/* ラベル */}
                  <div className="mt-1.5 relative h-4">
                    <span className="absolute font-mono text-[8px] text-[#f87171]" style={{ left: 0 }}>
                      {(lo * 100).toFixed(1)}% 割高
                    </span>
                    <span
                      className={`absolute -translate-x-1/2 font-mono text-[9px] font-bold ${
                        s.divYield >= cfg.buyYield ? "text-[#34d399]" : s.divYield <= cfg.sellYield ? "text-[#f87171]" : "text-[#e8f4ff]"
                      }`}
                      style={{ left: `${curPos}%` }}
                    >
                      ▲ {(s.divYield * 100).toFixed(2)}%
                    </span>
                    <span className="absolute right-0 font-mono text-[8px] text-[#34d399]">
                      割安 {(hi * 100).toFixed(1)}%
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[10px] text-slate-400">
                    現在の利回りは過去5年の
                    <span className={`mx-1 font-bold ${
                      yieldStats.currentPercentile >= 70 ? "text-[#34d399]"
                      : yieldStats.currentPercentile <= 30 ? "text-[#f87171]"
                      : "text-[#e8f4ff]"
                    }`}>
                      上位{100 - yieldStats.currentPercentile}%
                    </span>
                    （中央値 {(yieldStats.yieldMedian * 100).toFixed(2)}%）
                  </p>
                </div>
              );
            })()}

            {/* エピソード継続期間 */}
            <div className="border-t border-white/[0.08] pt-4">
              <p className="font-mono text-[9px] text-slate-500 mb-3">各状態の継続期間（過去5年実績）</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "割高（SELL）状態",
                    ep: yieldStats.sellEpisodes,
                    cls: "border-[#f87171]/20 bg-[#f87171]/[0.03]",
                    color: "text-[#f87171]",
                    note: "割高から中立に戻るまでの目安",
                  },
                  {
                    label: "割安（BUY）状態",
                    ep: yieldStats.buyEpisodes,
                    cls: "border-[#34d399]/20 bg-[#34d399]/[0.03]",
                    color: "text-[#34d399]",
                    note: "買い場の継続期間目安",
                  },
                ].map(({ label, ep, cls, color, note }) => (
                  <div key={label} className={`rounded-xl border ${cls} px-4 py-3`}>
                    <p className="font-mono text-[9px] text-slate-500 mb-2">{label}</p>
                    {ep ? (
                      <>
                        <div className="grid grid-cols-3 gap-1 mb-2">
                          {[
                            { k: "発生回数", v: `${ep.count}回` },
                            { k: "平均",     v: `${ep.avgDays}日` },
                            { k: "最長",     v: `${ep.maxDays}日` },
                          ].map(({ k, v }) => (
                            <div key={k} className="text-center">
                              <p className="font-mono text-[7px] text-slate-600">{k}</p>
                              <p className={`font-mono text-sm font-bold ${color}`}>{v}</p>
                            </div>
                          ))}
                        </div>
                        <p className="font-mono text-[8px] text-slate-600">{note}</p>
                        <p className="font-mono text-[8px] text-slate-500 mt-0.5">
                          中央値 {ep.medianDays}日 ≈ 約{Math.round(ep.medianDays / 30)}ヶ月
                        </p>
                      </>
                    ) : (
                      <p className="font-mono text-[10px] text-slate-600">過去5年で該当なし</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-3 font-mono text-[8px] text-slate-600">
              ※ 過去利回りは現在の年間配当 ¥{cfg.annualDiv}/株 で近似計算。実際の過去配当とは異なる場合があります。
            </p>
          </div>
        )}

        {/* シグナル根拠 */}
        <div className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.11] p-5">
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
            <p className="text-slate-500">
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

        <p className="mt-6 font-mono text-[10px] leading-6 text-slate-500">
          データ: Yahoo Finance ({ticker})。配当利回りシグナル: Z=1.88, n=20, 26年統計 (decisions/0033)。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
