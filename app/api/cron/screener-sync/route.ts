import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import {
  fetchEquitiesMaster,
  fetchFinSummary,
  fetchAllBarsForDate,
  calcMetrics,
  JqBar,
} from "@/lib/jquants";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const FINS_BATCH = 5;    // fins/summary の並列数（レート制限を考慮）
const FINS_DELAY = 400;  // バッチ間ms
const MAX_MS = 260_000;

function todayJST(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000); // UTC+9
  return d.toISOString().slice(0, 10);
}

function latestWorkday(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  // 土(6)→金, 日(0)→金
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // offset / limit でチャンク処理（デフォルトは全件）
  const url = new URL(req.url);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
  const limit = parseInt(url.searchParams.get("limit") ?? "9999", 10);

  const db = getSupabaseServer();
  const start = Date.now();

  // 全銘柄マスタ取得
  const master = await fetchEquitiesMaster();
  const equities = master
    .filter((e) => ["プライム", "スタンダード", "グロース"].some((m) => e.MktNm.includes(m)))
    .slice(offset, offset + limit);

  // 全銘柄の株価を1リクエストで取得（失敗しても続行）
  const date = latestWorkday();
  const allBars: Map<string, JqBar> = await fetchAllBarsForDate(date);
  const bulkBarsOk = allBars.size > 0;

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < equities.length; i += FINS_BATCH) {
    if (Date.now() - start > MAX_MS) break;

    const batch = equities.slice(i, i + FINS_BATCH);

    await Promise.all(
      batch.map(async (eq) => {
        try {
          const summaries = await fetchFinSummary(eq.Code);

          // バー: bulk取得済みならMapから、なければskip（個別再取得しない）
          const bar = allBars.get(eq.Code) ?? null;

          if (summaries.length === 0 && bar === null) {
            skipped++;
            return;
          }

          const m = calcMetrics(eq, summaries, bar);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (db as any).from("screener_stocks").upsert({
            code: m.code,
            name: m.name,
            market: m.market,
            sector: m.sector,
            price: m.price,
            pbr: m.pbr,
            per: m.per,
            roe: m.roe,
            roa: m.roa,
            equity_ratio: m.equityRatio,
            operating_margin: m.operatingMargin,
            dividend_yield: m.dividendYield,
            revenue_growth_yoy: m.revenueGrowthYoy,
            net_sales: m.netSales,
            operating_profit: m.operatingProfit,
            total_assets: m.totalAssets,
            equity: m.equity,
            growth_flag: m.growthFlag,
            value_flag: m.valueFlag,
            updated_at: new Date().toISOString(),
          });

          synced++;
        } catch (e) {
          errors++;
          if (errorSamples.length < 5) {
            errorSamples.push(`${eq.Code}: ${String(e)}`);
          }
        }
      })
    );

    if (i + FINS_BATCH < equities.length && Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, FINS_DELAY));
    }
  }

  const processed = offset + Math.min(equities.length, synced + skipped + errors);

  return NextResponse.json({
    ok: true,
    date,
    bulkBarsOk,
    bulkBarsCount: allBars.size,
    total: master.filter((e) => ["プライム", "スタンダード", "グロース"].some((m) => e.MktNm.includes(m))).length,
    offset,
    limit,
    processed,
    synced,
    skipped,
    errors,
    elapsedMs: Date.now() - start,
    errorSamples,
  });
}
