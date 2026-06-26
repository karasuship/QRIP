import { NextResponse } from "next/server";
import { fetchListedInfo, fetchStatements, fetchLatestQuote, calcMetrics } from "@/lib/jquants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// テスト用: NTT(9432) の財務データを取得して返す
export async function GET() {
  try {
    const [info, statements, quote] = await Promise.all([
      fetchListedInfo().then((list) => list.find((i) => i.Code === "9432") ?? null),
      fetchStatements("9432"),
      fetchLatestQuote("9432"),
    ]);

    if (!info) return NextResponse.json({ error: "9432 が見つからなかった" }, { status: 404 });

    const metrics = calcMetrics(info, statements, quote);

    return NextResponse.json({
      ok: true,
      metrics,
      raw: {
        statementsCount: statements.length,
        latestStatement: statements[0] ?? null,
        quote,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
