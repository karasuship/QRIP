"use client";

import { getSupabaseBrowser } from "@/lib/supabase";

export default function LoginPrompt({ next }: { next: string }) {
  const login = async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  return (
    <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-10 text-center">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">ログインが必要</p>
      <p className="text-sm text-slate-400">このページはログインユーザーのみ利用できます。</p>
      <button
        onClick={login}
        className="mt-2 flex items-center gap-2 rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.08] px-5 py-2.5 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/[0.16] transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.8 20-21 0-1.4-.1-2.7-.5-4z" fill="#38bdf8" opacity=".8"/>
        </svg>
        Google でログイン
      </button>
    </div>
  );
}
