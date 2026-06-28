import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

const DEMO_CODES = ["9432", "2914", "9433", "6758", "7203"];

export async function GET() {
  const db = getSupabaseServer();
  const { data } = await db
    .from("screener_stocks")
    .select("code, name, price, dividend_yield, week52_high, week52_low, pbr, market")
    .in("code", DEMO_CODES);

  const map = new Map((data ?? []).map((s: { code: string }) => [s.code, s]));
  const stocks = DEMO_CODES.map((c) => map.get(c)).filter(Boolean);

  return NextResponse.json({ stocks }, { headers: { "Cache-Control": "s-maxage=900" } });
}
