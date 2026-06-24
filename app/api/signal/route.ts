import { NextResponse } from "next/server";
import { fetchSignal } from "@/lib/signal";

export const revalidate = 900;

export async function GET() {
  try {
    const data = await fetchSignal();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "signal fetch failed" }, { status: 502 });
  }
}
