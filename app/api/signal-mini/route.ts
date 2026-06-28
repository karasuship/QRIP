import { NextResponse } from "next/server";
import { fetchSignal } from "@/lib/signal";

export const runtime = "nodejs";
export const revalidate = 900;

export async function GET() {
  try {
    const s = await fetchSignal();
    return NextResponse.json(
      {
        athDd:       s.athDd,
        crs:         s.crs,
        vix:         s.vix,
        price:       s.price,
        signalTier:  s.signalTier,
        date:        s.date,
      },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=60" } },
    );
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 500 });
  }
}
