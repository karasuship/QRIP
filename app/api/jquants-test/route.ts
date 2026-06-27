import { NextResponse } from "next/server";
import { fetchEquitiesMaster, fetchFinSummary, fetchAllBarsForDate, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function latestWorkday(): string {
  const d = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dow = d.getUTCDay();
  if (dow === 6) d.setUTCDate(d.getUTCDate() - 1);
  else if (dow === 0) d.setUTCDate(d.getUTCDate() - 2);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const date = latestWorkday();

    // 1. 全銘柄一括バー取得テスト
    const allBars = await fetchAllBarsForDate(date);

    // 2. NTT(94320)の個別テスト
    const master = await fetchEquitiesMaster();
    const ntt = master.find((e) => e.Code === "94320") ?? null;
    if (!ntt) return NextResponse.json({ error: "94320 が見つからなかった" }, { status: 404 });

    const summaries = await fetchFinSummary("9432");
    const bar = allBars.get("94320") ?? null;
    const metrics = calcMetrics(ntt, summaries, bar);

    return NextResponse.json({
      ok: true,
      date,
      bulkBarsOk: allBars.size > 0,
      bulkBarsCount: allBars.size,
      nttBarFromBulk: bar,
      metrics,
      summariesCount: summaries.length,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
