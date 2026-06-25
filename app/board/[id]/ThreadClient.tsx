"use client";

import { useState, useEffect, useRef } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { Post } from "./page";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}日前`;
  return new Date(iso).toLocaleDateString("ja-JP");
}

function getHandle(): string {
  if (typeof window === "undefined") return "名無し";
  let h = localStorage.getItem("qrip_handle");
  if (!h) {
    h = "名無し" + Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem("qrip_handle", h);
  }
  return h;
}

export default function ThreadClient({ threadId, initialPosts }: { threadId: number; initialPosts: Post[] }) {
  const [posts, setPosts] = useState<Post[]>(initialPosts);
  const [content, setContent] = useState("");
  const [handle, setHandle] = useState("名無し");
  const [posting, setPosting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHandle(getHandle());
  }, []);

  const submit = async () => {
    if (!content.trim()) return;
    setPosting(true);
    const client = getSupabaseBrowser();
    if (!client) { setPosting(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;

    const { data } = await sb.from("board_posts").insert({
      thread_id: threadId,
      content: content.trim(),
      handle,
    }).select().single();

    if (data) {
      setPosts((prev) => [...prev, data as Post]);
      setContent("");
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      await sb.from("board_threads").update({ post_count: posts.length + 1, last_post_at: new Date().toISOString() }).eq("id", threadId);
    }
    setPosting(false);
  };

  return (
    <div className="mt-6">
      {/* 投稿一覧 */}
      <div className="space-y-3">
        {posts.length === 0 && (
          <p className="font-mono text-xs text-slate-600 py-4">まだ投稿がありません。最初のコメントを書きましょう。</p>
        )}
        {posts.map((p, i) => (
          <div key={p.id} className="rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[10px] text-slate-600">#{i + 1}</span>
              <span className="font-mono text-[10px] text-slate-400">@{p.handle}</span>
              <span className="font-mono text-[10px] text-slate-700 ml-auto">{timeAgo(p.created_at)}</span>
            </div>
            <p className="text-sm leading-7 text-slate-300 whitespace-pre-wrap">{p.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 投稿フォーム */}
      <div className="mt-6 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-4 space-y-3">
        <p className="font-mono text-[10px] text-slate-500">返信する（@{handle}）</p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="投稿内容を入力..."
          rows={4}
          className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25] resize-none"
        />
        <div className="flex items-center justify-between">
          <p className="font-mono text-[10px] text-slate-700">
            脅迫・個人情報の開示は即削除。投資推奨は「このサイトのロジックでは」で枕詞をつけてください。
          </p>
          <button
            onClick={submit}
            disabled={!content.trim() || posting}
            className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] px-4 py-1.5 font-mono text-[10px] text-[#38bdf8] disabled:opacity-40 hover:bg-[#38bdf8]/[0.12] transition-colors"
          >
            {posting ? "投稿中..." : "投稿"}
          </button>
        </div>
      </div>
    </div>
  );
}
