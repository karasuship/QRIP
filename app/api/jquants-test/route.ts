import { NextResponse } from "next/server";
import { fetchEquitiesMaster, fetchFinSummary, fetchLatestBar, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NTT(9432) でV2 APIの疎通確認
export async function GET() {
  try {
    const [master, summaries, bar] = await Promise.all([
      fetchEquitiesMaster().then((list) => list.find((e) => e.Code === "9432") ?? null),
      fetchFinSummary("9432"),
      fetchLatestBar("9432"),
    ]);

    if (!master) return NextResponse.json({ error: "9432 が見つからなかった" }, { status: 404 });

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
