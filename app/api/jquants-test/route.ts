import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.jquants.com/v2";

async function tryGet(path: string, params?: Record<string, string>) {
  const apiKey = process.env.JQUANTS_API_KEY ?? "";
  const url = new URL(`${BASE}${path}`);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${apiKey}` },
    next: { revalidate: 0 },
  });
  const body = await res.text();
  let parsed: unknown;
  try { parsed = JSON.parse(body); } catch { parsed = body; }
  return { status: res.status, ok: res.ok, body: parsed };
}

// 各エンドポイントを個別に試す診断ルート
export async function GET() {
  const results = await Promise.allSettled([
    tryGet("/equities/master").then(r => ({ endpoint: "/equities/master", ...r })),
    tryGet("/equities/bars/daily", { code: "9432", date_from: "2025-06-01", date_to: "2025-06-27" })
      .then(r => ({ endpoint: "/equities/bars/daily", ...r })),
    tryGet("/fins/summary", { code: "9432" })
      .then(r => ({ endpoint: "/fins/summary", ...r })),
    tryGet("/fins/details", { code: "9432" })
      .then(r => ({ endpoint: "/fins/details", ...r })),
    tryGet("/fins/dividend", { code: "9432" })
      .then(r => ({ endpoint: "/fins/dividend", ...r })),
  ]);

  const report = results.map(r =>
    r.status === "fulfilled" ? r.value : { endpoint: "?", error: String(r.reason) }
  );

  return NextResponse.json(report);
}
