import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchEquitiesMaster, fetchFinSummary, fetchLatestBar, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const maxDuration = 300;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

const BATCH = 20;
const MAX_MS = 270_000; // 270秒以内で打ち切り（Vercel制限の余裕を持たせる）

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseServer();
  const start = Date.now();

  // 全銘柄マスタを取得
  const master = await fetchEquitiesMaster();
  // 株式のみ（ETF等を除外）
  const equities = master.filter((e) =>
    ["プライム", "スタンダード", "グロース"].some((m) => e.MktNm.includes(m))
  );

  let synced = 0;
  let skipped = 0;
  let errors = 0;
  const errorSamples: string[] = [];

  for (let i = 0; i < equities.length; i += BATCH) {
    // タイムアウト前に打ち切り
    if (Date.now() - start > MAX_MS) break;

    const batch = equities.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (eq) => {
        try {
          const [summaries, bar] = await Promise.all([
            fetchFinSummary(eq.Code),
            fetchLatestBar(eq.Code),
          ]);

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

    // バッチ間に少し待機してレート制限を避ける
    if (i + BATCH < equities.length && Date.now() - start < MAX_MS) {
      await new Promise((r) => setTimeout(r, 300));
    }
  }

  return NextResponse.json({
    ok: true,
    total: equities.length,
    synced,
    skipped,
    errors,
    elapsedMs: Date.now() - start,
    errorSamples,
  });
}
