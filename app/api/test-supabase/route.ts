import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getSupabaseServer();

    // 1. SELECT（テーブル存在確認）
    const selectResult = await db
      .from("screener_stocks")
      .select("code", { count: "exact", head: true });

    // 2. 1行 upsert テスト
    const upsertResult = await db.from("screener_stocks").upsert({
      code: "TEST00",
      name: "テスト銘柄",
      market: "テスト",
      sector: "テスト",
      price: null, pbr: null, per: null, roe: null, roa: null,
      equity_ratio: null, operating_margin: null, dividend_yield: null,
      revenue_growth_yoy: null, net_sales: null, operating_profit: null,
      total_assets: null, equity: null, growth_flag: null, value_flag: null,
      updated_at: new Date().toISOString(),
    });

    // 3. テスト行を削除
    const deleteResult = await db.from("screener_stocks").delete().eq("code", "TEST00");

    return NextResponse.json({
      select: {
        count: selectResult.count,
        error: selectResult.error ? { message: selectResult.error.message, code: selectResult.error.code } : null,
      },
      upsert: {
        error: upsertResult.error ? { message: upsertResult.error.message, code: upsertResult.error.code, details: upsertResult.error.details } : null,
      },
      delete: {
        error: deleteResult.error ? { message: deleteResult.error.message } : null,
      },
      env: {
        urlSet: !!process.env.SUPABASE_URL,
        keySet: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        urlPrefix: process.env.SUPABASE_URL?.slice(0, 30),
      },
    });
  } catch (e) {
    return NextResponse.json({ thrown: String(e) }, { status: 500 });
  }
}
