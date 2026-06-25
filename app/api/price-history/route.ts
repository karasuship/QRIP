import { NextRequest, NextResponse } from "next/server";

// サポートする range → interval のマッピング
const INTERVAL_MAP: Record<string, string> = {
  "5d":  "5m",
  "1mo": "1d",
  "6mo": "1d",
  "1y":  "1d",
  "2y":  "1wk",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticker = searchParams.get("t") ?? "%5EGSPC";   // ^GSPC = S&P500
  const range  = searchParams.get("r") ?? "1y";

  const interval = INTERVAL_MAP[range] ?? "1d";
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}` +
    `?interval=${interval}&range=${range}&includePrePost=false`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept":          "application/json,*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer":         "https://finance.yahoo.com/",
      },
      next: { revalidate: range === "5d" ? 900 : 3600 },
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Yahoo ${res.status}` }, { status: 502 });
    }

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) {
      return NextResponse.json({ error: "no result" }, { status: 502 });
    }

    const ts: number[]             = result.timestamp ?? [];
    const q                        = result.indicators?.quote?.[0] ?? {};
    const adjClose: (number|null)[] =
      result.indicators?.adjclose?.[0]?.adjclose ?? q.close ?? [];
    const rawHigh: (number|null)[] = q.high ?? [];

    // 有効な点だけ抽出
    const points: { time: number; close: number }[] = [];
    const highVals: number[] = [];

    for (let i = 0; i < ts.length; i++) {
      const c = adjClose[i];
      const h = rawHigh[i];
      if (c != null && isFinite(c)) {
        points.push({ time: ts[i] * 1000, close: Math.round(c * 100) / 100 });
      }
      if (h != null && isFinite(h)) highVals.push(h);
    }

    if (points.length === 0) {
      return NextResponse.json({ error: "no valid points" }, { status: 502 });
    }

    const ath52w   = highVals.length ? Math.max(...highVals) : points[points.length - 1].close;
    const latest   = points[points.length - 1].close;
    const drawdown = (latest - ath52w) / ath52w;   // 負の値

    const meta = result.meta ?? {};

    return NextResponse.json(
      {
        ticker:     meta.symbol ?? ticker,
        currency:   meta.currency ?? "USD",
        range,
        interval,
        points,
        ath52w:    Math.round(ath52w * 100) / 100,
        latest,
        drawdown,
        updatedAt: Date.now(),
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${range === "5d" ? 900 : 3600}, stale-while-revalidate=60`,
        },
      },
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
