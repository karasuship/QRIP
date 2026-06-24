import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { pushSubscribeLimiter, getClientIP, rateLimitHeaders } from "@/lib/ratelimit";

export async function POST(req: NextRequest) {
  // レートリミット
  if (pushSubscribeLimiter) {
    const ip = getClientIP(req);
    const { success, remaining, reset } = await pushSubscribeLimiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: rateLimitHeaders(remaining, reset) }
      );
    }
  }

  try {
    const sub = await req.json();

    // 構造チェック
    if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    // endpoint は https:// から始まる URL のみ
    if (!sub.endpoint.startsWith("https://")) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }
    // 各フィールドの長さ上限（Web Push 仕様の想定値）
    if (
      sub.endpoint.length  > 2048 ||
      sub.keys.p256dh.length > 256 ||
      sub.keys.auth.length   > 64
    ) {
      return NextResponse.json({ error: "invalid subscription" }, { status: 400 });
    }

    const db = getSupabaseServer();
    await db.from("push_subscriptions").upsert(
      {
        endpoint:  sub.endpoint,
        p256dh:    sub.keys.p256dh,
        auth:      sub.keys.auth,
      },
      { onConflict: "endpoint" }
    );

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint || typeof endpoint !== "string") {
      return NextResponse.json({ error: "no endpoint" }, { status: 400 });
    }

    const db = getSupabaseServer();
    await db.from("push_subscriptions").delete().eq("endpoint", endpoint);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
