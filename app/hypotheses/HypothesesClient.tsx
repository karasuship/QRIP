"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";

interface Hypothesis {
  id: number;
  title: string;
  body: string | null;
  status: string;
  vote_count: number;
  handle: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  open:     "検証待ち",
  testing:  "検証中",
  adopted:  "採用",
  rejected: "棄却",
};

const STATUS_COLOR: Record<string, string> = {
  open:     "border-[#38bdf8]/30 text-[#38bdf8]",
  testing:  "border-amber-400/30 text-amber-400",
  adopted:  "border-[#34d399]/30 text-[#34d399]",
  rejected: "border-white/[0.12] text-slate-600",
};

function getHandle(): string {
  if (typeof window === "undefined") return "名無し";
  let h = localStorage.getItem("qrip_handle");
  if (!h) {
    h = "名無し" + Math.random().toString(36).slice(2, 6).toUpperCase();
    localStorage.setItem("qrip_handle", h);
  }
  return h;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86400000);
  if (d === 0) return "今日";
  if (d < 30) return `${d}日前`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}ヶ月前`;
  return `${Math.floor(m / 12)}年前`;
}

export default function HypothesesClient({ initialHypotheses }: { initialHypotheses: Hypothesis[] }) {
  const [hypotheses, setHypotheses] = useState<Hypothesis[]>(initialHypotheses);
  const [votedIds, setVotedIds] = useState<Set<number>>(new Set());
  const [handle, setHandle] = useState("名無し");
  const [showForm, setShowForm] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fBody, setFBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [filter, setFilter] = useState<"all" | "open" | "testing" | "adopted">("all");

  useEffect(() => {
    setHandle(getHandle());
    // 投票済みIDをlocalStorageから復元
    const raw = localStorage.getItem("qrip_voted_hypotheses");
    if (raw) {
      try { setVotedIds(new Set(JSON.parse(raw) as number[])); } catch { /* ignore */ }
    }
  }, []);

  const vote = useCallback(async (id: number) => {
    if (votedIds.has(id)) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    if (!sb) return;

    await sb.from("hypothesis_votes").insert({ hypothesis_id: id, handle });
    // vote_count を楽観的更新
    setHypotheses((prev) =>
      prev.map((h) => h.id === id ? { ...h, vote_count: h.vote_count + 1 } : h)
    );
    const next = new Set([...votedIds, id]);
    setVotedIds(next);
    localStorage.setItem("qrip_voted_hypotheses", JSON.stringify([...next]));
  }, [votedIds, handle]);

  const submit = async () => {
    if (!fTitle.trim()) return;
    setPosting(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    if (!sb) { setPosting(false); return; }

    const { data } = await sb.from("hypotheses").insert({
      title: fTitle.trim(),
      body: fBody.trim() || null,
      handle,
      status: "open",
      vote_count: 0,
    }).select().single();

    if (data) {
      setHypotheses((prev) => [data as Hypothesis, ...prev]);
      setFTitle(""); setFBody(""); setShowForm(false);
    }
    setPosting(false);
  };

  const sorted = [...hypotheses]
    .filter((h) => filter === "all" || h.status === filter)
    .sort((a, b) => b.vote_count - a.vote_count);

  return (
    <div className="mt-6">
      {/* フィルター */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {(["all", "open", "testing", "adopted"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 font-mono text-[10px] transition-colors ${
                filter === f
                  ? "border-white/[0.25] bg-white/[0.08] text-slate-200"
                  : "border-white/[0.10] text-slate-500 hover:text-slate-300"
              }`}
            >
              {f === "all" ? "全て" : STATUS_LABEL[f]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.06] px-3 py-1.5 font-mono text-[10px] text-[#38bdf8] hover:bg-[#38bdf8]/[0.12] transition-colors"
        >
          + 仮説を提案する
        </button>
      </div>

      {/* 提案フォーム */}
      {showForm && (
        <div className="mb-5 rounded-2xl border border-white/[0.12] bg-white/[0.05] p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">新しい検証仮説</p>
          <input
            value={fTitle}
            onChange={(e) => setFTitle(e.target.value)}
            placeholder="例: FOMC声明のタカ派スコアはphi2発動確率を高めるか"
            className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]"
          />
          <textarea
            value={fBody}
            onChange={(e) => setFBody(e.target.value)}
            placeholder="仮説の根拠や背景（任意）"
            rows={3}
            className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25] resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-slate-600">投稿者: @{handle}</span>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="font-mono text-[10px] text-slate-600 hover:text-slate-400">キャンセル</button>
              <button
                onClick={submit}
                disabled={!fTitle.trim() || posting}
                className="rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.08] px-3 py-1.5 font-mono text-[10px] text-[#38bdf8] disabled:opacity-40 hover:bg-[#38bdf8]/[0.14] transition-colors"
              >
                {posting ? "提案中..." : "提案する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 仮説一覧（投票数順） */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="font-mono text-xs text-slate-600">仮説はまだありません。最初の仮説を提案しましょう。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((h, rank) => (
            <div key={h.id} className="flex items-start gap-3 rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3">
              {/* 投票ボタン */}
              <button
                onClick={() => vote(h.id)}
                disabled={votedIds.has(h.id)}
                className={`flex shrink-0 flex-col items-center rounded-xl border px-2.5 py-1.5 transition-all ${
                  votedIds.has(h.id)
                    ? "border-[#38bdf8]/40 bg-[#38bdf8]/[0.08] text-[#38bdf8]"
                    : "border-white/[0.10] text-slate-500 hover:border-[#38bdf8]/30 hover:text-[#38bdf8]"
                }`}
              >
                <span className="text-xs">▲</span>
                <span className="font-mono text-sm font-bold leading-none mt-0.5">{h.vote_count}</span>
              </button>

              {/* 内容 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-mono text-[9px] text-slate-700">#{rank + 1}</span>
                  <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${STATUS_COLOR[h.status] ?? "text-slate-500 border-white/[0.12]"}`}>
                    {STATUS_LABEL[h.status] ?? h.status}
                  </span>
                </div>
                <p className="text-sm text-slate-200 leading-snug">{h.title}</p>
                {h.body && (
                  <p className="mt-1 text-xs leading-5 text-slate-500 line-clamp-2">{h.body}</p>
                )}
                <p className="mt-1 font-mono text-[10px] text-slate-700">@{h.handle} · {timeAgo(h.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 font-mono text-[10px] leading-6 text-slate-700">
        投票数の多い仮説から順に検証キューに入ります。検証結果は /research に公開されます。
      </p>
    </div>
  );
}
