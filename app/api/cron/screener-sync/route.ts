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

// 5並列 × 5秒待機 = 実効1req/sec（ベースプランのレート制限内）
const BATCH = 5;
const DELAY = 5_000;
const MAX_MS = 260_000;
const DEFAULT_LIMIT = 200; // 1回の実行で約200件（40バッチ × 5秒 = 200秒）

// 曜日ベースの自動オフセット（月〜金で約1000件/週カバー）
function autoOffset(): number {
  const dow = new Date().getDay(); // 0=日, 1=月 ... 5=金
  const table: Record<number, number> = { 1: 0, 2: 200, 3: 400, 4: 600, 5: 800 };
  return table[dow] ?? 0;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? String(autoOffset()), 10);
  const limit = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);

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
        if (errorSamples.length < 3) errorSamples.push(String(r.reason).slice(0, 120));
        continue;
      }
      const { eq, summaries } = r.value;
      if (summaries.length === 0) { skipped++; continue; }
      const m = calcMetrics(eq, summaries, null);
      rows.push({
        code: m.code, name: m.name, market: m.market, sector: m.sector,
        price: null, pbr: null, per: null,
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
        if (errorSamples.length < 3) errorSamples.push(`upsert: ${error.message}`);
      } else {
        synced += rows.length;
      }
    }

    if (i + BATCH < equities.length && Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, DELAY));
    }
  }

  const nextOffset = offset + limit;

  return NextResponse.json({
    ok: true,
    total: all.length,
    offset,
    limit,
    synced,
    skipped,
    errors,
    elapsedMs: Date.now() - start,
    nextOffset: nextOffset < all.length ? nextOffset : null,
    errorSamples,
  });
}
