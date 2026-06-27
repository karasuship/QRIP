import { NextResponse } from "next/server";
import { fetchEquitiesMaster, fetchFinSummary, fetchLatestBar, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NTT = コード94320（5桁）でテスト
export async function GET() {
  try {
    const [master, summaries, bar] = await Promise.all([
      fetchEquitiesMaster().then((list) => list.find((e) => e.Code === "94320") ?? null),
      fetchFinSummary("9432"),
      fetchLatestBar("9432"),
    ]);

    if (!master) return NextResponse.json({ error: "94320 が見つからなかった" }, { status: 404 });

    const metrics = calcMetrics(master, summaries, bar);

    return NextResponse.json({
      ok: true,
      metrics,
      raw: {
        summariesCount: summaries.length,
        latestSummary: summaries[0] ?? null,
        bar,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
