import type { Metadata } from "next";
import Link from "next/link";
import SimulateClient from "./SimulateClient";
import AssetAllocation from "./AssetAllocation";

export const metadata: Metadata = {
  title: "QRIP — 資産シミュレーション・配分例",
  description: "月次積立・ボーナス・NISA・phi2戦略の30年試算。インデックス比較と推奨ポートフォリオ例。",
};

export default async function SimulatePage({
  searchParams,
}: {
  searchParams: Promise<{ stock?: string; yield?: string }>;
}) {
  const sp = await searchParams;
  const stockName = sp.stock ? decodeURIComponent(sp.stock) : undefined;
  const divYield = sp.yield ? parseFloat(sp.yield) : undefined;

  const initialStock =
    stockName && divYield != null && !isNaN(divYield)
      ? { name: stockName, divYield }
      : undefined;

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Simulate / 試算</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">資産シミュレーション</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            月積立・ボーナス・NISA・戦略を変えて30年後の資産を試算する。
            数値はバックテスト由来の期待値。実際のリターンは変動する。
          </p>
          {initialStock && (
            <div className="mt-3 rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-4 py-2">
              <p className="font-mono text-[10px] text-[#38bdf8]">
                {initialStock.name} の配当利回り {initialStock.divYield.toFixed(1)}% を初期設定しました。資産配分・利回りは自由に変更できます。
              </p>
            </div>
          )}
        </div>

        <SimulateClient initialStock={initialStock} />
        <AssetAllocation />
      </main>
    </div>
  );
}
