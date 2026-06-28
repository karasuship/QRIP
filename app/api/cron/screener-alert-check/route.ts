import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import type { AlertConditions } from "@/app/api/screener-alerts/route";

export const runtime = "nodejs";
export const maxDuration = 30;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

interface AlertRow {
  id: number;
  user_id: string;
  conditions: AlertConditions;
  last_hit_codes: string[] | null;
}

interface StockRow {
  code: string;
  pbr: number | null;
  per: number | null;
  dividend_yield: number | null;
  roe: number | null;
  equity_ratio: number | null;
  market: string | null;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseServer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: alerts, error: alertErr } = await (db as any)
    .from("user_screener_alerts")
    .select("id, user_id, conditions, last_hit_codes");

  if (alertErr) return NextResponse.json({ error: alertErr.message }, { status: 500 });
  if (!alerts || alerts.length === 0) return NextResponse.json({ ok: true, checked: 0 });

  // 全銘柄の価格系カラムを一括取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stocks, error: stockErr } = await (db as any)
    .from("screener_stocks")
    .select("code, pbr, per, dividend_yield, roe, equity_ratio, market")
    .not("price", "is", null);

  if (stockErr) return NextResponse.json({ error: stockErr.message }, { status: 500 });
  const allStocks = (stocks ?? []) as StockRow[];

  let checked = 0;
  let updated = 0;

  for (const alert of (alerts as AlertRow[])) {
    const c: AlertConditions = alert.conditions;

    const hits = allStocks.filter((s) => {
      if (c.pbr_max            != null && (s.pbr           == null || s.pbr           > c.pbr_max))            return false;
      if (c.per_max            != null && (s.per           == null || s.per           > c.per_max))            return false;
      if (c.dividend_yield_min != null && (s.dividend_yield == null || s.dividend_yield < c.dividend_yield_min)) return false;
      if (c.roe_min            != null && (s.roe           == null || s.roe           < c.roe_min))            return false;
      if (c.equity_ratio_min   != null && (s.equity_ratio  == null || s.equity_ratio  < c.equity_ratio_min))   return false;
      if (c.market             != null && c.market !== "" && s.market !== c.market)                            return false;
      return true;
    });

    const hitCodes = hits.map((s) => s.code);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)
      .from("user_screener_alerts")
      .update({ last_hit_codes: hitCodes, last_checked: new Date().toISOString() })
      .eq("id", alert.id);

    checked++;
    if (hitCodes.length !== (alert.last_hit_codes ?? []).length) updated++;
  }

  return NextResponse.json({ ok: true, checked, updated });
}
