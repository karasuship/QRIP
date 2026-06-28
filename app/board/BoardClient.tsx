"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { Thread } from "./page";

const CATEGORIES = ["全て", "銘柄", "仮説", "考察", "サイトへの質問"] as const;
type Category = typeof CATEGORIES[number];

const CAT_STYLE: Record<string, string> = {
  "銘柄":         "border-amber-400/30 text-amber-400",
  "仮説":         "border-[#34d399]/30 text-[#34d399]",
  "考察":         "border-[#38bdf8]/30 text-[#38bdf8]",
  "サイトへの質問": "border-slate-400/30 text-slate-400",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "たった今";
  if (m < 60) return `${m}分前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.floor(h / 24)}日前`;
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

export default function BoardClient({ initialThreads }: { initialThreads: Thread[] }) {
  const [threads, setThreads] = useState<Thread[]>(initialThreads);
  const [activeCategory, setActiveCategory] = useState<Category>("全て");
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCat, setNewCat] = useState("考察");
  const [newTicker, setNewTicker] = useState("");
  const [handle, setHandle] = useState("名無し");
  const [posting, setPosting] = useState(false);
  const [user, setUser] = useState<{ id: string } | null>(null);

  useEffect(() => {
    setHandle(getHandle());
    const sb = getSupabaseBrowser();
    if (!sb) return;
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const filtered = activeCategory === "全て"
    ? threads
    : threads.filter((t) => t.category === activeCategory);

  const postThread = useCallback(async () => {
    if (!newTitle.trim()) return;
    setPosting(true);
    const client = getSupabaseBrowser();
    if (!client) { setPosting(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;
    const { data } = await sb.from("board_threads").insert({
      title: newTitle.trim(),
      category: newCat,
      ticker: newCat === "銘柄" && newTicker.trim() ? newTicker.trim().toUpperCase() : null,
      handle,
      post_count: 0,
      last_post_at: new Date().toISOString(),
    }).select().single();
    if (data) {
      setThreads((prev) => [data as Thread, ...prev]);
      setNewTitle(""); setNewTicker(""); setShowNew(false);
    }
    setPosting(false);
  }, [newTitle, newCat, newTicker, handle]);

  const changeHandle = () => {
    const h = prompt("ハンドル名を入力（このデバイスで固定されます）", handle);
    if (h && h.trim()) {
      const trimmed = h.trim().slice(0, 20);
      localStorage.setItem("qrip_handle", trimmed);
      setHandle(trimmed);
    }
  };

  return (
    <div className="mt-6">
      {/* ツールバー */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCategory(c)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-colors ${
                activeCategory === c
                  ? "border-white/[0.25] bg-white/[0.14] text-slate-200"
                  : "border-white/[0.18] text-slate-500 hover:text-slate-300 hover:border-white/[0.18]"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={changeHandle}
            className="font-mono text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
          >
            @{handle} ✎
          </button>
          <button
            onClick={() => setShowNew((v) => !v)}
            className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] px-3 py-1.5 font-mono text-[10px] text-[#38bdf8] hover:bg-[#38bdf8]/[0.10] transition-colors"
          >
            + スレッドを立てる
          </button>
        </div>
      </div>

      {/* 新規スレッド作成 */}
      {showNew && (
        <div className="mb-4 rounded-2xl border border-white/[0.22] bg-white/[0.05] p-4 space-y-3">
          <p className="font-mono text-[10px] text-slate-400">新規スレッド</p>
          <div className="flex gap-2 flex-wrap">
            {(["銘柄", "仮説", "考察", "サイトへの質問"] as const).map((c) => (
              <button
                key={c}
                onClick={() => setNewCat(c)}
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] transition-colors ${
                  newCat === c ? CAT_STYLE[c] + " bg-current/[0.06]" : "border-white/[0.18] text-slate-500"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          {newCat === "銘柄" && (
            <input
              value={newTicker}
              onChange={(e) => setNewTicker(e.target.value)}
              placeholder="ティッカー（例: 7203.T, SPY）"
              className="w-full rounded-xl border border-white/[0.18] bg-white/[0.14] px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]"
            />
          )}
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="スレッドタイトル（例: NTTの配当落ち前後の動きを考察する）"
            className="w-full rounded-xl border border-white/[0.18] bg-white/[0.14] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-slate-500">投稿者: @{handle}</span>
            <div className="flex gap-2">
              <button onClick={() => setShowNew(false)} className="font-mono text-[10px] text-slate-500 hover:text-slate-400">キャンセル</button>
              <button
                onClick={postThread}
                disabled={!newTitle.trim() || posting}
                className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-3 py-1.5 font-mono text-[10px] text-[#34d399] disabled:opacity-40 hover:bg-[#34d399]/[0.14] transition-colors"
              >
                {posting ? "投稿中..." : "スレッドを作成"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* スレッド一覧 */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.15] bg-white/[0.11] p-8 text-center">
          <p className="font-mono text-xs text-slate-500">まだスレッドがありません。最初のスレッドを立てましょう。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/board/${t.id}`}
              className="block rounded-xl border border-white/[0.18] bg-white/[0.11] px-4 py-3 hover:bg-white/[0.11] hover:border-white/[0.18] transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${CAT_STYLE[t.category] ?? "border-slate-400/30 text-slate-400"}`}>
                      {t.category}
                    </span>
                    {t.ticker && (
                      <span className="font-mono text-[10px] text-amber-400/70">{t.ticker}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-snug line-clamp-1">{t.title}</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-500">@{t.handle} · {timeAgo(t.last_post_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-xs text-slate-500">{t.post_count}</p>
                  <p className="font-mono text-[9px] text-slate-500">件</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] leading-6 text-slate-500">
        脅迫・個人情報の交換・スパムは即時削除。投資の最終判断はご自身で。
      </p>
    </div>
  );
}
