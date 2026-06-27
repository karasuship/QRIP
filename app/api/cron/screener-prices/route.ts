import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchPricesYahoo, getYahooCreds } from "@/lib/yahoo-finance";

export const runtime = "nodejs";
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const BATCH = 100; // Yahoo Finance に1リクエストで送る銘柄数
const DELAY = 150; // バッチ間ms

function calcValueFlag(
  pbr: number | null, per: number | null,
  equityRatio: number | null, roe: number | null,
  revenueGrowth: number | null, operatingMargin: number | null
): string | null {
  const eqR = equityRatio ?? 0;
  const growth = revenueGrowth ?? 0;
  const om = operatingMargin ?? 0;

  if (pbr !== null && pbr <= 0.5 && eqR >= 0.6 && roe !== null && roe >= 0.05) return "優良バリュー";
  if (growth > 0.20 && eqR < 0.5) return "急成長警戒";
  if (pbr !== null && pbr <= 0.5 && roe !== null && roe < 0.03) return "低収益放置";
  if (per !== null && per <= 12 && om >= 0.15) return "高収益割安";
  return null;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseServer();
  const start = Date.now();

  // bps が null でない銘柄（fins sync 済み）を全件取得
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stocks, error: fetchErr } = await (db as any)
    .from("screener_stocks")
    .select("code,bps,eps,div_ann,equity_ratio,roe,revenue_growth_yoy,operating_margin")
    .not("bps", "is", null);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const allStocks = (stocks ?? []) as {
    code: string;
    bps: number | null; eps: number | null; div_ann: number | null;
    equity_ratio: number | null; roe: number | null;
    revenue_growth_yoy: number | null; operating_margin: number | null;
  }[];

  // Yahoo Finance セッション認証（1回取得して全バッチで再利用）
  const creds = await getYahooCreds();

  let updated = 0;
  let noPrice = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < allStocks.length; i += BATCH) {
    const batch = allStocks.slice(i, i + BATCH);
    const codes5 = batch.map((s) => s.code);

    let prices: Map<string, number>;
    try {
      prices = await fetchPricesYahoo(codes5, creds);
    } catch (e) {
      errors += batch.length;
      if (errorSamples.length < 3) errorSamples.push(String(e).slice(0, 100));
      continue;
    }

    const rows: Record<string, unknown>[] = [];
    for (const s of batch) {
      const price = prices.get(s.code);
      if (!price) { noPrice++; continue; }

      const bps = s.bps;
      const eps = s.eps;
      const divAnn = s.div_ann;

      const pbr = bps && bps > 0 ? price / bps : null;
      const per = eps && eps > 0 ? price / eps : null;
      const dividendYield = divAnn && divAnn > 0 ? divAnn / price : null;
      const valueFlag = calcValueFlag(pbr, per, s.equity_ratio, s.roe, s.revenue_growth_yoy, s.operating_margin);

      rows.push({ code: s.code, price, pbr, per, dividend_yield: dividendYield, value_flag: valueFlag });
    }

    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("screener_stocks").upsert(rows);
      if (error) {
        errors += rows.length;
        if (errorSamples.length < 3) errorSamples.push(`upsert: ${error.message}`);
      } else {
        updated += rows.length;
      }
    }

    if (i + BATCH < allStocks.length) {
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  return NextResponse.json({
    ok: true,
    total: allStocks.length,
    updated,
    noPrice,
    errors,
    elapsedMs: Date.now() - start,
    errorSamples,
  });
}
