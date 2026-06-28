import type { Metadata } from "next";
import Link from "next/link";
import { getSupabaseServer } from "@/lib/supabase";
import JournalClient from "./JournalClient";

export const metadata: Metadata = {
  title: "QRIP — 投資日誌",
  description: "購入時の判断根拠と感情を記録する。暴落時の冷却装置。",
};

export const revalidate = 900;

export default async function JournalPage() {
  let todayCrs: number | null = null;
  let todayPhi2 = false;

  try {
    const db = getSupabaseServer();
    const { data } = await db
      .from("market_daily")
      .select("crs_score, phi2_active")
      .order("date", { ascending: false })
      .limit(1)
      .single();
    if (data) {
      todayCrs = data.crs_score ?? null;
      todayPhi2 = data.phi2_active ?? false;
    }
  } catch { /* silent */ }

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500">Journal / 投資日誌</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">投資日誌</h1>
            <p className="mt-1 font-mono text-[10px] text-slate-500">
              なぜ買ったか・その時の感情を残す。暴落中に読み返す冷却装置として使う。
            </p>
          </div>

          {/* 今日のスナップショット */}
          {todayCrs !== null && (
            <div className="flex items-center gap-3 rounded-xl border border-white/[0.18] bg-white/[0.14] px-4 py-2.5">
              <div className="text-center">
                <p className="font-mono text-[9px] text-slate-500 uppercase">今日の CRS</p>
                <p className={`font-mono text-xl font-bold mt-0.5 ${todayCrs >= 5 ? "text-[#f87171]" : todayCrs >= 3 ? "text-amber-400" : todayCrs >= 2 ? "text-[#38bdf8]" : "text-slate-500"}`}>
                  {todayCrs}
                </p>
              </div>
              <div className="w-px h-8 bg-white/[0.10]" />
              <div className="text-center">
                <p className="font-mono text-[9px] text-slate-500 uppercase">phi2</p>
                <p className={`font-mono text-xs font-bold mt-0.5 ${todayPhi2 ? "text-[#34d399]" : "text-slate-500"}`}>
                  {todayPhi2 ? "発動中" : "未発動"}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* 使い方ヒント */}
        <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3">
          <p className="text-xs leading-6 text-amber-400/80">
            <strong className="text-amber-400">使い方のコツ：</strong>
            「暴落が怖い」「本当に今買っていいのか」と思った瞬間に記録する。
            1〜2年後に読み返すと、恐怖がいかに合理的でなかったかが分かる。
            CRS・phi2フラグを残しておくと、シグナルの精度検証にも使える。
          </p>
        </div>

        <JournalClient todayCrs={todayCrs} todayPhi2={todayPhi2} />

        <p className="mt-8 font-mono text-[10px] leading-6 text-slate-500">
          データはログインアカウントに紐づきサーバーに保存されます。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
