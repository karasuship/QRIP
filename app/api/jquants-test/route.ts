import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BASE = "https://api.jquants.com/v2";
const TEST_PATH = "/equities/master";

async function tryAuth(label: string, headers: Record<string, string>, urlParams?: Record<string, string>) {
  const url = new URL(`${BASE}${TEST_PATH}`);
  if (urlParams) Object.entries(urlParams).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString(), { headers, next: { revalidate: 0 } });
    const body = await res.json().catch(() => null);
    const count = Array.isArray((body as { equities?: unknown[] })?.equities)
      ? (body as { equities: unknown[] }).equities.length
      : null;
    return { label, status: res.status, ok: res.ok, count, error: res.ok ? null : body };
  } catch (e) {
    return { label, status: 0, ok: false, count: null, error: String(e) };
  }
}

export async function GET() {
  const key = process.env.JQUANTS_API_KEY ?? "";
  if (!key) return NextResponse.json({ error: "JQUANTS_API_KEY 未設定" });

  const results = await Promise.all([
    tryAuth("Authorization: Bearer {key}", { Authorization: `Bearer ${key}` }),
    tryAuth("Authorization: {key} (Bearerなし)", { Authorization: key }),
    tryAuth("X-Api-Key: {key}", { "X-Api-Key": key }),
    tryAuth("クエリパラメータ ?apikey={key}", {}, { apikey: key }),
    tryAuth("クエリパラメータ ?token={key}", {}, { token: key }),
  ]);

  return NextResponse.json({ keyLength: key.length, results });
}
