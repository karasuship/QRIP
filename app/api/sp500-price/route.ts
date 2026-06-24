import { NextRequest, NextResponse } from "next/server";

// Yahoo Finance から指定日付近辺の SP500 終値を取得する
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date"); // YYYY-MM-DD

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({ error: "date param required (YYYY-MM-DD)" }, { status: 400 });
  }

  // 指定日 ±5日のウィンドウで取得（祝日・週末対応）
  const target = new Date(dateStr + "T12:00:00Z");
  const t1 = Math.floor((target.getTime() / 1000) - 5 * 86400);
  const t2 = Math.floor((target.getTime() / 1000) + 5 * 86400);

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?interval=1d&period1=${t1}&period2=${t2}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finance.yahoo.com/",
      },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return NextResponse.json({ error: `Yahoo HTTP ${res.status}` }, { status: 502 });

    const json = await res.json();
    const result = json.chart?.result?.[0];
    if (!result) return NextResponse.json({ error: "no data" }, { status: 502 });

    const timestamps: number[] = result.timestamp ?? [];
    const closes: (number | null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ??
      result.indicators?.quote?.[0]?.close ??
      [];

    // 指定日に最も近い営業日の価格を返す
    let bestDate = "";
    let bestPrice = 0;
    let bestDiff = Infinity;

    for (let i = 0; i < timestamps.length; i++) {
      const v = closes[i];
      if (v === null || v === undefined || isNaN(v)) continue;
      const d = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);
      const diff = Math.abs(timestamps[i] - target.getTime() / 1000);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestDate = d;
        bestPrice = v;
      }
    }

    if (!bestDate) return NextResponse.json({ error: "no price found" }, { status: 502 });

    return NextResponse.json({ date: bestDate, price: Math.round(bestPrice * 100) / 100 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
