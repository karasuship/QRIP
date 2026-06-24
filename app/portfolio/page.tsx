import { fetchSignal } from "@/lib/signal";
import type { Metadata } from "next";
import Link from "next/link";
import PortfolioClient from "./PortfolioClient";

export const metadata: Metadata = {
  title: "QRIP — ポートフォリオトラッカー",
  description: "phi2シグナル購入 vs DCAベースラインの実績比較。",
};

export const revalidate = 900;

export default async function PortfolioPage() {
  let currentPrice = 0;
  let currentDate = "";

  try {
    const signal = await fetchSignal();
    if (signal) {
      currentPrice = signal.price;
      currentDate = signal.date;
    }
  } catch { /* silent */ }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Portfolio / 実績</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">ポートフォリオトラッカー</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-400">
            phi2 シグナル購入 vs DCA の実績を記録・比較する。データはブラウザに保存。
          </p>
        </div>

        {currentPrice === 0 ? (
          <p className="mt-8 font-mono text-sm text-red-400">SP500 価格の取得に失敗しました。しばらく後に再読み込みしてください。</p>
        ) : (
          <div className="mt-6">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-2.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">SP500 現在値</span>
              <span className="font-mono text-base font-bold text-[#38bdf8]">{currentPrice.toLocaleString("ja-JP", { maximumFractionDigits: 2 })}</span>
              <span className="font-mono text-[10px] text-slate-500">({currentDate})</span>
            </div>
            <PortfolioClient currentPrice={currentPrice} currentDate={currentDate} />
          </div>
        )}

        <p className="mt-8 font-mono text-[10px] leading-6 text-slate-400">
          データはブラウザの localStorage に保存されます。ブラウザを変えると引き継がれません。
          投資成績はあくまで参考値です。これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
