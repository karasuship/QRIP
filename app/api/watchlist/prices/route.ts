import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const token = req.headers.get("x-sb-token");
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // ウォッチリスト取得
  const { data: wl } = await sb
    .from("user_watchlist")
    .select("stock_code, stock_name")
    .eq("user_id", user.id);

  if (!wl || wl.length === 0) return NextResponse.json({ stocks: [] });

  const codes = wl.map((w: { stock_code: string }) => w.stock_code);

  // screener_stocks から価格・指標を取得
  const admin = createClient(url, key);
  const { data: stocks } = await admin
    .from("screener_stocks")
    .select("code, name, price, dividend_yield, week52_high, week52_low, pbr, market")
    .in("code", codes);

  // ウォッチリストの並び順で返す
  const map = new Map((stocks ?? []).map((s: { code: string }) => [s.code, s]));
  const result = wl.map((w: { stock_code: string; stock_name: string | null }) => ({
    code: w.stock_code,
    name: w.stock_name ?? (map.get(w.stock_code) as { name?: string })?.name ?? w.stock_code,
    ...(map.get(w.stock_code) ?? {}),
  }));

  return NextResponse.json({ stocks: result });
}
