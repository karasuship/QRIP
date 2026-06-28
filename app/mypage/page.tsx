import type { Metadata } from "next";
import Link from "next/link";
import MyPageClient from "./MyPageClient";

export const metadata: Metadata = {
  title: "QRIP — マイページ",
  description: "ウォッチリスト・スクリーナーアラート・シグナル通知設定。",
};

export default function MyPage() {
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">My Page</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">マイページ</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            ウォッチリスト・スクリーナーアラート・通知設定
          </p>
        </div>

        <MyPageClient />
      </main>
    </div>
  );
}
