import type { Metadata } from "next";
import { getSupabaseServer } from "@/lib/supabase";
import ScreenerClient from "./ScreenerClient";

export const metadata: Metadata = {
  title: "株スクリーナー — PBR・PER・配当利回りで全上場銘柄を絞り込む",
  description: "約3700銘柄をPBR・PER・自己資本比率・配当利回り・ROE・ROA・営業利益率・売上成長率でスクリーニング。割安・高配当・高ROEのバリュー株を簡単に発見。",
};

export const revalidate = 3600;

export default async function ScreenerPage() {
  let totalCount = 0;
  try {
    const db = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (db as any)
      .from("screener_stocks")
      .select("*", { count: "exact", head: true });
    totalCount = count ?? 0;
  } catch { /* フォールバック */ }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-7xl px-4 py-10">
        <div className="mb-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Screener / バリュー株スクリーナー</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">
            バリュー株スクリーナー
          </h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            毎日夜間に J-Quants データを同期。スライダーを動かすと即座に絞り込む。
          </p>
        </div>

        {totalCount === 0 ? (
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] p-12 text-center space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">データ準備中</p>
            <p className="text-sm text-slate-400">
              夜間バッチが初回同期中です。しばらくお待ちください。
            </p>
            <p className="font-mono text-[10px] text-slate-500">
              手動で同期する場合: <code className="text-slate-500">/api/cron/screener-sync</code> を叩いてください。
            </p>
          </div>
        ) : (
          <ScreenerClient totalCount={totalCount} />
        )}

        <p className="mt-6 font-mono text-[9px] text-slate-500">
          データ: J-Quants API（東証全市場）。財務データは直近通期決算。株価は直近営業日。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
