import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export interface AlertConditions {
  pbr_max?: number;
  per_max?: number;
  dividend_yield_min?: number;
  roe_min?: number;
  equity_ratio_min?: number;
  market?: string;
}

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
    .from("user_screener_alerts")
    .select("id, name, conditions, last_hit_codes, last_checked, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alerts: data ?? [] });
}

export async function POST(req: NextRequest) {
  const sb = getSupabase(req);
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, conditions } = body as { name?: string; conditions?: AlertConditions };
  if (!conditions) return NextResponse.json({ error: "conditions required" }, { status: 400 });

  const { data, error } = await sb
    .from("user_screener_alerts")
    .insert({ user_id: user.id, name: name ?? "条件1", conditions })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

export async function DELETE(req: NextRequest) {
  const sb = getSupabase(req);
  const { data: { user }, error: authErr } = await sb.auth.getUser();
  if (authErr || !user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await sb
    .from("user_screener_alerts")
    .delete()
    .eq("user_id", user.id)
    .eq("id", Number(id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
