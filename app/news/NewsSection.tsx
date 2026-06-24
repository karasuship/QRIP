"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { HeadlineJa } from "@/lib/news-analyze";
import type { ExpandResult } from "@/app/api/news-expand/route";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

// ── types ────────────────────────────────────────────────────────────────────

interface NewsComment {
  id: string;
  user_name: string | null;
  content: string;
  created_at: string;
}

interface NewsItem extends HeadlineJa {
  newsId: string;
  initialLikeCount: number;
}

interface NewsSectionProps {
  items: NewsItem[];
}

// ── impact config ────────────────────────────────────────────────────────────

const IMPACT = {
  bullish: { label: "SP500 ↑",  color: "text-[#34d399] border-[#34d399]/30 bg-[#34d399]/[0.08]" },
  bearish: { label: "SP500 ↓",  color: "text-[#f87171] border-[#f87171]/30 bg-[#f87171]/[0.08]" },
  neutral: { label: "SP500 →",  color: "text-slate-400 border-white/[0.12] bg-white/[0.06]" },
} as const;

const DIR_ICON: Record<string, string> = { bullish: "↑", bearish: "↓", neutral: "→" };

// ── HeadlineCard ─────────────────────────────────────────────────────────────

function HeadlineCard({
  item,
  user,
  onLogin,
}: {
  item: NewsItem;
  user: User | null;
  onLogin: () => void;
}) {
  const supabase = getSupabaseBrowser();
  const [expanded, setExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [deep, setDeep] = useState<ExpandResult | null>(null);
  const [deepLoading, setDeepLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(item.initialLikeCount);
  const [comments, setComments] = useState<NewsComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fetchedLike = useRef(false);

  // Check if user liked this item
  useEffect(() => {
    if (!user || fetchedLike.current) return;
    fetchedLike.current = true;
    supabase
      .from("news_reactions")
      .select("id")
      .eq("news_item_id", item.newsId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [user, item.newsId]);

  // Load comments when section opens
  useEffect(() => {
    if (!showComments) return;
    supabase
      .from("news_comments")
      .select("id, user_name, content, created_at")
      .eq("news_item_id", item.newsId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setComments(data ?? []));
  }, [showComments, item.newsId]);

  const handleExpand = useCallback(async () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !deep && !deepLoading) {
      setDeepLoading(true);
      try {
        const res = await fetch("/api/news-expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: item.title,
            description: item.description,
            source: item.source,
          }),
        });
        if (res.ok) setDeep(await res.json());
      } catch { /* silent */ }
      setDeepLoading(false);
    }
  }, [expanded, deep, deepLoading, item]);

  const handleLike = useCallback(async () => {
    if (!user) { onLogin(); return; }
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      await supabase
        .from("news_reactions")
        .delete()
        .eq("news_item_id", item.newsId)
        .eq("user_id", user.id);
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("news_reactions")
        .insert({ news_item_id: item.newsId, user_id: user.id });
    }
  }, [user, liked, item.newsId, onLogin]);

  const handleComment = useCallback(async () => {
    if (!user || !commentText.trim() || submitting) return;
    setSubmitting(true);
    const content = commentText.trim().slice(0, 200);
    const userName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "匿名";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("news_comments")
      .insert({ news_item_id: item.newsId, user_id: user.id, user_name: userName, content })
      .select("id, user_name, content, created_at")
      .single();
    if (data) {
      setComments((prev) => [...prev, data as NewsComment]);
      setCommentText("");
    }
    setSubmitting(false);
  }, [user, commentText, submitting, item.newsId]);

  const impact = IMPACT[item.sp500_impact] ?? IMPACT.neutral;

  return (
    <div className="rounded-2xl border border-white/[0.12] bg-white/[0.06] overflow-hidden backdrop-blur-sm">
      {/* clickable header */}
      <button onClick={handleExpand} className="w-full px-5 py-4 text-left hover:bg-white/[0.03] transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium leading-snug text-[#e8f4ff]">{item.title}</p>
            {item.description && (
              <p className="mt-1 text-xs leading-5 text-slate-400 line-clamp-2">{item.description}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium ${impact.color}`}>
            {impact.label}
          </span>
        </div>
        {item.sp500_reason && (
          <p className="mt-1.5 text-[11px] text-slate-500">{item.sp500_reason}</p>
        )}
        <div className="mt-2 flex items-center gap-3">
          <span className="rounded-full border border-white/[0.09] bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-slate-500">
            {item.source}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            {expanded ? "▲ 閉じる" : "▼ 深掘り分析"}
          </span>
        </div>
      </button>

      {/* deep analysis */}
      {expanded && (
        <div className="border-t border-white/[0.09] bg-white/[0.03] px-5 py-4">
          {deepLoading ? (
            <p className="animate-pulse font-mono text-xs text-[#38bdf8]">● 分析中...</p>
          ) : deep ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className={`font-mono text-xs font-bold ${
                  deep.sp500_direction === "bullish" ? "text-[#34d399]"
                  : deep.sp500_direction === "bearish" ? "text-[#f87171]"
                  : "text-slate-400"
                }`}>
                  SP500 {DIR_ICON[deep.sp500_direction]}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-300">{deep.deep_analysis}</p>
              {deep.key_numbers.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {deep.key_numbers.map((n, i) => (
                    <span key={i} className="rounded-full border border-[#38bdf8]/20 bg-[#38bdf8]/[0.06] px-3 py-0.5 font-mono text-[11px] text-[#38bdf8]">
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {deep.watch_next && (
                <p className="text-xs text-slate-500">
                  <span className="text-slate-400">次に注目: </span>{deep.watch_next}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-600">分析に失敗しました</p>
          )}
        </div>
      )}

      {/* footer: likes + comments toggle */}
      <div className="border-t border-white/[0.09] flex items-center gap-4 px-5 py-2.5">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1.5 font-mono text-xs transition-colors ${
            liked ? "text-[#f87171]" : "text-slate-500 hover:text-slate-400"
          }`}
        >
          <span className="text-sm">{liked ? "♥" : "♡"}</span>
          <span>{likeCount}</span>
        </button>
        <button
          onClick={() => setShowComments((s) => !s)}
          className="flex items-center gap-1.5 font-mono text-xs text-slate-500 hover:text-slate-400 transition-colors"
        >
          <span>💬</span>
          <span>{showComments ? "閉じる" : comments.length > 0 ? `${comments.length}件` : "コメント"}</span>
        </button>
        {user ? (
          <span className="ml-auto font-mono text-[10px] text-slate-600 truncate max-w-[160px]">
            {(user.user_metadata?.full_name as string | undefined) ?? user.email}
          </span>
        ) : (
          <button
            onClick={onLogin}
            className="ml-auto font-mono text-[10px] text-[#38bdf8]/60 hover:text-[#38bdf8] transition-colors"
          >
            Googleでログイン →
          </button>
        )}
      </div>

      {/* comments section */}
      {showComments && (
        <div className="border-t border-white/[0.09] bg-white/[0.02] px-5 py-3 space-y-2">
          {comments.length === 0 && (
            <p className="text-xs text-slate-600">まだコメントはありません</p>
          )}
          {comments.map((c) => (
            <div key={c.id} className="text-xs leading-5">
              <span className="font-medium text-slate-400">{c.user_name ?? "匿名"}</span>
              <span className="mx-1.5 text-white/10">·</span>
              <span className="text-slate-400">{c.content}</span>
            </div>
          ))}
          {user ? (
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value.slice(0, 200))}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder="コメント（200字以内）..."
                className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.06] px-3 py-1.5 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-[#38bdf8]/30"
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submitting}
                className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/10 px-3 py-1.5 font-mono text-xs text-[#38bdf8] disabled:opacity-40 hover:bg-[#38bdf8]/20 transition-colors"
              >
                送信
              </button>
            </div>
          ) : (
            <button
              onClick={onLogin}
              className="rounded-xl border border-white/[0.18] bg-white/[0.07] px-4 py-1.5 font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors"
            >
              Google でログインしてコメントする
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── NewsSection ───────────────────────────────────────────────────────────────

export default function NewsSection({ items }: NewsSectionProps) {
  const supabase = getSupabaseBrowser();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/news`,
      },
    });
  }, []);

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <HeadlineCard key={item.newsId} item={item} user={user} onLogin={handleLogin} />
      ))}
    </div>
  );
}
