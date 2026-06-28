import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getSupabase(req: NextRequest) {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const token = req.headers.get("x-sb-token");
  const sb = createClient(url, key, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  });
  return sb;
}

export async function GET(req: NextRequest) {
  const sb = getSupabase(req);
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await sb
    .from("user_watchlist")
    .select("id, stock_code, stock_name, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ watchlist: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = getSupabase(req);
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { stock_code, stock_name } = body as { stock_code?: string; stock_name?: string };
  if (!stock_code) return NextResponse.json({ error: "stock_code required" }, { status: 400 });

  const { error } = await sb
    .from("user_watchlist")
    .upsert({ user_id: user.id, stock_code, stock_name: stock_name ?? null });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const sb = getSupabase(req);
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const stock_code = searchParams.get("code");
  if (!stock_code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const { error } = await sb
    .from("user_watchlist")
    .delete()
    .eq("user_id", user.id)
    .eq("stock_code", stock_code);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
