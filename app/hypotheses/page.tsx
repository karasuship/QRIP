import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import HypothesesClient from "./HypothesesClient";

export const metadata: Metadata = {
  title: "QRIP — 検証仮説",
  description: "ユーザーが提案する検証仮説。投票数の多い順に研究キューへ。",
};

export const revalidate = 120;

interface Hypothesis {
  id: number;
  title: string;
  body: string | null;
  status: string;
  vote_count: number;
  handle: string | null;
  created_at: string;
}

export default async function HypothesesPage() {
  let hypotheses: Hypothesis[] = [];
  let dbReady = true;

  try {
    const db = getSupabaseServer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (db as any)
      .from("hypotheses")
      .select("id, title, body, status, vote_count, handle, created_at")
      .order("vote_count", { ascending: false })
      .limit(100);
    if (error) dbReady = false;
    else hypotheses = (data ?? []) as Hypothesis[];
  } catch {
    dbReady = false;
  }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Hypotheses / 仮説投票</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">検証仮説</h1>
          <p className="mt-1 font-mono text-[10px] text-slate-500">
            「次にこれを検証してほしい」を提案・投票。票数順に研究キューへ入る。
          </p>
        </div>

        {/* 仕組みの説明 */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { step: "01", label: "提案する", desc: "検証してほしい仮説を自由に書く" },
            { step: "02", label: "投票する", desc: "面白いと思った仮説に投票（1人1票）" },
            { step: "03", label: "検証される", desc: "票数順にバックテスト。結果は /research に公開" },
          ].map((s) => (
            <div key={s.step} className="rounded-xl border border-white/[0.18] bg-white/[0.11] px-4 py-3 flex gap-3">
              <span className="font-mono text-xl font-bold text-white/[0.08] shrink-0">{s.step}</span>
              <div>
                <p className="text-sm font-medium text-slate-300">{s.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {!dbReady ? (
          <div className="mt-8 rounded-2xl border border-white/[0.18] bg-white/[0.14] p-8 text-center space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">準備中</p>
            <p className="text-sm text-slate-400">データベースを初期化中です。しばらくお待ちください。</p>
          </div>
        ) : (
          <HypothesesClient initialHypotheses={hypotheses} />
        )}
      </main>
    </div>
  );
}
