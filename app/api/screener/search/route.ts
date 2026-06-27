import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const p = req.nextUrl.searchParams;

  let q = db
    .from("screener_stocks")
    .select("code,name,market,sector,price,pbr,per,roe,roa,equity_ratio,operating_margin,dividend_yield,revenue_growth_yoy,growth_flag,value_flag");

  const pbrMax = parseFloat(p.get("pbr_max") ?? "");
  const perMax = parseFloat(p.get("per_max") ?? "");
  const eqMin  = parseFloat(p.get("equity_ratio_min") ?? "");
  const divMin = parseFloat(p.get("dividend_yield_min") ?? "");
  const roeMin = parseFloat(p.get("roe_min") ?? "");
  const roaMin = parseFloat(p.get("roa_min") ?? "");
  const omMin  = parseFloat(p.get("operating_margin_min") ?? "");
  const rgMax  = parseFloat(p.get("revenue_growth_max") ?? "");
  const market = p.get("market") ?? "";
  const flag   = p.get("value_flag") ?? "";

  if (!isNaN(pbrMax)) q = q.lte("pbr", pbrMax);
  if (!isNaN(perMax)) q = q.lte("per", perMax);
  if (!isNaN(eqMin)  && eqMin  > 0) q = q.gte("equity_ratio",      eqMin  / 100);
  if (!isNaN(divMin) && divMin > 0) q = q.gte("dividend_yield",     divMin / 100);
  if (!isNaN(roeMin) && roeMin > 0) q = q.gte("roe",                roeMin / 100);
  if (!isNaN(roaMin) && roaMin > 0) q = q.gte("roa",                roaMin / 100);
  if (!isNaN(omMin)  && omMin  > 0) q = q.gte("operating_margin",   omMin  / 100);
  if (!isNaN(rgMax))                q = q.lte("revenue_growth_yoy", rgMax  / 100);
  if (market && market !== "全て")  q = q.eq("market", market);
  if (flag   && flag   !== "全て")  q = q.eq("value_flag", flag);

  const { data, error } = await q
    .order("roe", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}
