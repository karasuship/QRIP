import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import BoardClient from "./BoardClient";

export const metadata: Metadata = {
  title: "QRIP — 掲示板",
  description: "銘柄・仮説・考察を自由に書き込める掲示板。仮説への投票機能付き。",
};

export const revalidate = 60;

export interface Thread {
  id: number;
  title: string;
  category: string;
  ticker: string | null;
  handle: string | null;
  post_count: number;
  last_post_at: string;
  created_at: string;
}

export default async function BoardPage() {
  let threads: Thread[] = [];
  let dbReady = true;

  try {
    const db = getSupabaseServer();
    const { data, error } = await db
      .from("board_threads")
      .select("id, title, category, ticker, handle, post_count, last_post_at, created_at")
      .order("last_post_at", { ascending: false })
      .limit(50);
    if (error) { dbReady = false; }
    else { threads = (data ?? []) as Thread[]; }
  } catch {
    dbReady = false;
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Board / 掲示板</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">掲示板</h1>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              銘柄・仮説・考察を自由に投稿。ハンドル固定。仮説への投票で検証キューが決まる。
            </p>
          </div>
        </div>

        {!dbReady ? (
          <div className="mt-8 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-8 text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">準備中</p>
            <p className="text-sm text-slate-400">掲示板のデータベースを初期化中です。しばらくお待ちください。</p>
            <p className="font-mono text-[10px] text-slate-600">（管理者: Supabase で board_threads・board_posts テーブルを作成してください）</p>
          </div>
        ) : (
          <BoardClient initialThreads={threads} />
        )}
      </main>
    </div>
  );
}
