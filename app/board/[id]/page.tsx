import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import ThreadClient from "./ThreadClient";

export const revalidate = 30;

export interface Post {
  id: number;
  content: string;
  handle: string | null;
  created_at: string;
}

export default async function ThreadPage({ params }: { params: { id: string } }) {
  const threadId = parseInt(params.id, 10);
  let thread: { id: number; title: string; category: string; ticker: string | null; handle: string | null; created_at: string } | null = null;
  let posts: Post[] = [];
  let dbReady = true;

  try {
    const db = getSupabaseServer();
    const [{ data: t }, { data: p }] = await Promise.all([
      db.from("board_threads").select("id, title, category, ticker, handle, created_at").eq("id", threadId).single(),
      db.from("board_posts").select("id, content, handle, created_at").eq("thread_id", threadId).order("created_at", { ascending: true }).limit(200),
    ]);
    thread = t ?? null;
    posts = (p ?? []) as Post[];
  } catch {
    dbReady = false;
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-4xl px-6 py-12">
          <Link href="/board" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">← 掲示板</Link>
          <p className="mt-8 text-sm text-slate-400">データベースが準備中です。</p>
        </main>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen">
        <main className="mx-auto max-w-4xl px-6 py-12">
          <Link href="/board" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">← 掲示板</Link>
          <p className="mt-8 text-sm text-slate-400">スレッドが見つかりません。</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/board" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← 掲示板にもどる
        </Link>

        <div className="mt-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-[10px] border border-white/[0.15] rounded-full px-2 py-0.5 text-slate-500">
              {thread.category}
            </span>
            {thread.ticker && (
              <span className="font-mono text-[10px] text-amber-400">{thread.ticker}</span>
            )}
          </div>
          <h1 className="text-xl font-semibold text-[#e8f4ff] leading-snug">{thread.title}</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-600">
            @{thread.handle} · スレッド作成
          </p>
        </div>

        <ThreadClient threadId={threadId} initialPosts={posts} />
      </main>
    </div>
  );
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  try {
    const db = getSupabaseServer();
    const { data } = await db.from("board_threads").select("title").eq("id", parseInt(params.id, 10)).single();
    return { title: `${data?.title ?? "スレッド"} — QRIP掲示板` };
  } catch {
    return { title: "スレッド — QRIP掲示板" };
  }
}
