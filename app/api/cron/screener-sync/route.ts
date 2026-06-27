import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchEquitiesMaster, fetchFinSummary, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const BATCH = 10;
const DELAY = 200;
const MAX_MS = 260_000;

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "9999", 10);

  const db = getSupabaseServer();
  const start = Date.now();

  const master = await fetchEquitiesMaster();
  const all = master.filter((e) =>
    ["プライム", "スタンダード", "グロース"].some((m) => e.MktNm.includes(m))
  );
  const equities = all.slice(offset, offset + limit);

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < equities.length; i += BATCH) {
    if (Date.now() - start > MAX_MS) break;

    const batch = equities.slice(i, i + BATCH);

    const settled = await Promise.allSettled(
      batch.map(async (eq) => {
        const summaries = await fetchFinSummary(eq.Code);
        return { eq, summaries };
      })
    );

    const rows: Record<string, unknown>[] = [];
    for (const r of settled) {
      if (r.status === "rejected") {
        errors++;
        if (errorSamples.length < 5) errorSamples.push(String(r.reason).slice(0, 120));
        continue;
      }
      const { eq, summaries } = r.value;
      if (summaries.length === 0) { skipped++; continue; }
      const m = calcMetrics(eq, summaries, null);
      rows.push({
        code: m.code, name: m.name, market: m.market, sector: m.sector,
        price: null, pbr: null, per: null, dividendYield: null,
        roe: m.roe, roa: m.roa,
        equity_ratio: m.equityRatio,
        operating_margin: m.operatingMargin,
        dividend_yield: m.dividendYield,
        revenue_growth_yoy: m.revenueGrowthYoy,
        net_sales: m.netSales, operating_profit: m.operatingProfit,
        total_assets: m.totalAssets, equity: m.equity,
        growth_flag: m.growthFlag, value_flag: m.valueFlag,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (db as any).from("screener_stocks").upsert(rows);
      if (error) {
        errors += rows.length;
        if (errorSamples.length < 5) errorSamples.push(`upsert: ${error.message}`);
      } else {
        synced += rows.length;
      }
    }

    if (i + BATCH < equities.length && Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  return NextResponse.json({
    ok: true,
    total: all.length,
    offset,
    processed: equities.length,
    synced,
    skipped,
    errors,
    elapsedMs: Date.now() - start,
    errorSamples,
  });
}
