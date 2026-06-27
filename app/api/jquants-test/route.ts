import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.jquants.com/v2";

async function jGet(path: string, params?: Record<string, string>) {
  const key = process.env.JQUANTS_API_KEY ?? "";
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { "X-Api-Key": key },
    next: { revalidate: 0 },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

export async function GET() {
  // /equities/master の生レスポンスを確認
  const master = await jGet("/equities/master");

  // レスポンスのトップレベルキーと先頭1件だけ返す
  const keys = master.body ? Object.keys(master.body) : [];
  const firstKey = keys[0];
  const firstItem = firstKey && Array.isArray(master.body[firstKey])
    ? (master.body[firstKey] as unknown[])[0]
    : master.body;

  return NextResponse.json({
    status: master.status,
    topLevelKeys: keys,
    firstItem,
  });
}
