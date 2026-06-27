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
  const today = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);

  const [barRes, finRes] = await Promise.all([
    jGet("/equities/bars/daily", { code: "94320", date_from: from, date_to: today }),
    jGet("/fins/summary", { code: "94320" }),
  ]);

  // バーは最後の1件だけ
  const barItem = Array.isArray(barRes.body?.data)
    ? barRes.body.data[barRes.body.data.length - 1]
    : barRes.body;

  // fins/summaryは件数とトップレベルキーと先頭1件
  const finKeys = finRes.body ? Object.keys(finRes.body) : [];
  const firstFinKey = finKeys[0];
  const finItem = firstFinKey && Array.isArray(finRes.body[firstFinKey])
    ? finRes.body[firstFinKey][0]
    : finRes.body;
  const finCount = firstFinKey && Array.isArray(finRes.body[firstFinKey])
    ? finRes.body[firstFinKey].length
    : 0;

  return NextResponse.json({
    bar: { status: barRes.status, item: barItem },
    fins: { status: finRes.status, topLevelKeys: finKeys, count: finCount, firstItem: finItem },
  });
}
