import type { Metadata } from "next";
import Link from "next/link";
import SimulateClient from "./SimulateClient";

export const metadata: Metadata = {
  title: "QRIP — 資産シミュレーション",
  description: "月次積立・ボーナス投下・NISA活用・phi2戦略の30年シミュレーション。",
};

export default function SimulatePage() {
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
        </div>

        <SimulateClient />
      </main>
    </div>
  );
}
