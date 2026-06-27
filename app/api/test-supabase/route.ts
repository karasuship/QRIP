import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getSupabaseServer() as any;

    // 総件数
    const { count: total } = await db.from("screener_stocks").select("code", { count: "exact", head: true });

    // dividend_yield が null でない件数
    const { count: divYieldNotNull } = await db.from("screener_stocks")
      .select("code", { count: "exact", head: true })
      .not("dividend_yield", "is", null);

    // dividend_yield >= 0.015 の件数
    const { count: divYield15 } = await db.from("screener_stocks")
      .select("code", { count: "exact", head: true })
      .gte("dividend_yield", 0.015);

    // div_ann が null でない件数
    const { count: divAnnNotNull } = await db.from("screener_stocks")
      .select("code", { count: "exact", head: true })
      .not("div_ann", "is", null);

    // bps が null でない件数
    const { count: bpsNotNull } = await db.from("screener_stocks")
      .select("code", { count: "exact", head: true })
      .not("bps", "is", null);

    // サンプル：dividend_yield が高い5件
    const { data: samples } = await db.from("screener_stocks")
      .select("code,name,price,div_ann,dividend_yield")
      .not("dividend_yield", "is", null)
      .order("dividend_yield", { ascending: false })
      .limit(5);

    return NextResponse.json({ total, divYieldNotNull, divYield15, divAnnNotNull, bpsNotNull, samples });
  } catch (e) {
    return NextResponse.json({ thrown: String(e) }, { status: 500 });
  }
}
