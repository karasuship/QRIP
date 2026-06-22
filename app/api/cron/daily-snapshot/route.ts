import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchMarketSnapshot, fetchSP500History } from "@/lib/market-fetch";

export const runtime = "nodejs";
export const maxDuration = 60;

// Vercel cron の認証チェック
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getSupabaseServer();

  // ──────────────────────────────────────────────
  // 1. 今日のスナップショット取得・計算
  // ──────────────────────────────────────────────
  let snapshot;
  try {
    snapshot = await fetchMarketSnapshot();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[cron] fetchMarketSnapshot failed:", msg);
    return NextResponse.json({ error: "fetch failed", detail: msg }, { status: 500 });
  }

  // ──────────────────────────────────────────────
  // 2. market_daily に upsert（同じ日は上書き）
  // ──────────────────────────────────────────────
  const { error: dailyErr } = await db
    .from("market_daily")
    .upsert(snapshot, { onConflict: "date" });

  if (dailyErr) {
    console.error("[cron] market_daily upsert error:", dailyErr.message);
    return NextResponse.json({ error: dailyErr.message }, { status: 500 });
  }

  // ──────────────────────────────────────────────
  // 3. phi2/RSI25 発動時は phi2_signals に挿入
  // ──────────────────────────────────────────────
  const fired: string[] = [];

  if (snapshot.phi2_active && snapshot.rsi25_crossunder) {
    fired.push("DOUBLE");
  } else if (snapshot.phi2_active) {
    fired.push("PHI2");
  } else if (snapshot.rsi25_crossunder) {
    fired.push("RSI25");
  }

  for (const signalType of fired) {
    const { error: sigErr } = await db.from("phi2_signals").upsert(
      {
        date: snapshot.date,
        signal_type: signalType,
        sp500_price: snapshot.sp500_close,
        ath_dd: snapshot.sp500_ath_dd,
        age_ath: snapshot.sp500_age_ath,
        vol20: snapshot.sp500_vol20,
        day_ret: snapshot.sp500_day_ret,
        rsi14: snapshot.sp500_rsi14,
        vix: snapshot.vix_spot,
        crs_score: snapshot.crs_score,
        crs_components: {
          c1: snapshot.crs_c1_vix30,
          c2: snapshot.crs_c2_hyg3d,
          c3: snapshot.crs_c3_dxy5d,
          c4: snapshot.crs_c4_age90,
          c5: snapshot.crs_c5_hyg60,
          c6: snapshot.crs_c6_rsp_weak,
        },
        vix_term_ratio: snapshot.vix_term_ratio,
      },
      { onConflict: "date,signal_type" }
    );
    if (sigErr) {
      console.error(`[cron] phi2_signals insert error (${signalType}):`, sigErr.message);
    }
  }

  // ──────────────────────────────────────────────
  // 4. 過去シグナルの事後リターン更新
  //    - 21d / 63d / 126d / 252d 経過したシグナルを更新
  // ──────────────────────────────────────────────
  const spHistory = await fetchSP500History();
  if (spHistory) {
    const [spDates, spVals] = spHistory;
    const priceByDate = new Map<string, number>();
    spDates.forEach((d, i) => priceByDate.set(d, spVals[i]));

    // ret_21d, ret_63d, ret_126d, ret_252d が null のシグナルを取得
    const { data: pending } = await db
      .from("phi2_signals")
      .select("id, date, sp500_price, ret_21d, ret_63d, ret_126d, ret_252d")
      .or("ret_21d.is.null,ret_63d.is.null,ret_126d.is.null,ret_252d.is.null");

    if (pending) {
      const today = snapshot.date;

      for (const row of pending) {
        const entry = priceByDate.get(row.date);
        if (!entry || !row.sp500_price) continue;

        const entryIdx = spDates.indexOf(row.date);
        if (entryIdx < 0) continue;

        function retAfterN(n: number): number | null {
          const targetIdx = entryIdx + n;
          if (targetIdx >= spDates.length) return null;
          // 未来日（まだデータない）は null のまま
          if (spDates[targetIdx] > today) return null;
          return spVals[targetIdx] / row.sp500_price - 1;
        }

        const updates: Record<string, number | null> = {};
        if (row.ret_21d === null) updates.ret_21d = retAfterN(21);
        if (row.ret_63d === null) updates.ret_63d = retAfterN(63);
        if (row.ret_126d === null) updates.ret_126d = retAfterN(126);
        if (row.ret_252d === null) updates.ret_252d = retAfterN(252);

        const hasUpdate = Object.values(updates).some((v) => v !== null);
        if (!hasUpdate) continue;

        await db.from("phi2_signals").update(updates).eq("id", row.id);
      }
    }
  }

  console.log(
    `[cron] ${snapshot.date} done. tier=${snapshot.signal_tier} crs=${snapshot.crs_score} fired=[${fired.join(",")}]`
  );

  return NextResponse.json({
    ok: true,
    date: snapshot.date,
    signal_tier: snapshot.signal_tier,
    crs_score: snapshot.crs_score,
    phi2_active: snapshot.phi2_active,
    rsi25_crossunder: snapshot.rsi25_crossunder,
    fired,
  });
}
