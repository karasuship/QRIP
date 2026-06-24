"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase";

function CallbackHandler() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const code = params.get("code");
    const next = params.get("next") ?? "/news";
    if (code) {
      getSupabaseBrowser()
        .auth.exchangeCodeForSession(code)
        .then(() => router.push(next))
        .catch(() => router.push(next));
    } else {
      router.push(next);
    }
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="font-mono text-sm text-[#38bdf8] animate-pulse">● 認証中...</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CallbackHandler />
    </Suspense>
  );
}
