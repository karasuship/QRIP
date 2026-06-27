/**
 * 信用取引残高 週次同期 cron
 *
 * データソース: softhompo.a.la9.jp（TSE PDFをCSV変換・無料公開）
 * URL: https://softhompo.a.la9.jp/Data/margin/thisMonth/syumatsu{YYYYMMDD}00.zip
 * スケジュール: 毎週火曜 12:00 UTC（= 水曜 9:00 JST）
 * 更新元の公開タイミング: 翌週第2営業日（火曜）夕方 → 水曜朝には確実に利用可能
 *
 * CSV カラム（TSE 標準フォーマット）:
 *   市場区分 / 銘柄コード / 銘柄名 / 信用買い残（株数）/ 信用買い残（金額・千円）/
 *   信用売り残（株数）/ 信用売り残（金額・千円）/ 倍率
 * ※ヘッダー行を動的にマップするので列順変更にも対応
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { unzipSync } from "fflate";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE = "https://softhompo.a.la9.jp/Data/margin/thisMonth";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** 直近の金曜日の日付を YYYYMMDD で返す（水曜実行なら5日前） */
function lastFridayStr(offsetWeeks = 0): string {
  const now = new Date();
  const dayOfWeek = now.getUTCDay(); // 0=Sun..5=Fri..6=Sat
  const daysSinceFriday = (dayOfWeek + 2) % 7;
  const d = new Date(now);
  d.setUTCDate(now.getUTCDate() - daysSinceFriday - offsetWeeks * 7);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** softhompo からZIPをダウンロードして解凍、CSV文字列を返す */
async function downloadMarginCsv(dateStr: string): Promise<string | null> {
  const url = `${BASE}/syumatsu${dateStr}00.zip`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; QRIP-bot/1.0)" },
    });
    if (!res.ok) return null;

    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);
    const firstFile = Object.values(files)[0];
    if (!firstFile) return null;

    // UTF-8 で試す（softhompo は UTF-8 変換済みの場合が多い）
    try {
      return new TextDecoder("utf-8").decode(firstFile);
    } catch {
      return new TextDecoder("shift-jis").decode(firstFile);
    }
  } catch {
    return null;
  }
}

/** CSV文字列を行・列にパース（タブ区切りまたはカンマ区切りを自動判定） */
function parseCsv(csv: string): { headers: string[]; rows: string[][] } {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // 最初の有効な行をヘッダーとして使う
  // タブ区切りかカンマ区切りかを判定
  const delim = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delim).map((h) => h.trim().replace(/^["']|["']$/g, ""));

  const rows = lines.slice(1).map((l) =>
    l.split(delim).map((c) => c.trim().replace(/^["']|["']$/g, ""))
  );

  return { headers, rows };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 最大3週分遡って最初に取得できたファイルを使う
  let csv: string | null = null;
  let usedDate = "";
  for (let i = 0; i <= 3; i++) {
    usedDate = lastFridayStr(i);
    csv = await downloadMarginCsv(usedDate);
    if (csv) break;
  }

  if (!csv) {
    return NextResponse.json({ error: "データ取得失敗（softhompo 404 or unreachable）", triedDates: [0,1,2,3].map(i => lastFridayStr(i)) }, { status: 502 });
  }

  const { headers, rows } = parseCsv(csv);

  // ヘッダーから列インデックスを動的に取得
  const idxOf = (candidates: string[]) => {
    for (const c of candidates) {
      const i = headers.findIndex((h) => h.includes(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const codeIdx  = idxOf(["銘柄コード", "コード", "Code"]);
  const buyIdx   = idxOf(["信用買い残（株数）", "買い残（株数）", "買残株数"]);
  const sellIdx  = idxOf(["信用売り残（株数）", "売り残（株数）", "売残株数"]);
  const ratioIdx = idxOf(["倍率", "貸借倍率"]);

  if (codeIdx < 0 || buyIdx < 0 || sellIdx < 0) {
    return NextResponse.json({
      error: "CSV カラム検出失敗",
      headers,
      firstRow: rows[0] ?? [],
    }, { status: 422 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const reportDate = `${usedDate.slice(0, 4)}-${usedDate.slice(4, 6)}-${usedDate.slice(6, 8)}`;

  const upsertRows: Record<string, unknown>[] = [];
  for (const row of rows) {
    if (row.length <= Math.max(codeIdx, buyIdx, sellIdx)) continue;
    const raw = row[codeIdx];
    if (!raw || !/^\d{4}$/.test(raw.trim())) continue; // 4桁コードのみ
    const code = raw.trim() + "0"; // 5桁へ

    const buy   = parseInt(row[buyIdx].replace(/,/g, ""), 10);
    const sell  = parseInt(row[sellIdx].replace(/,/g, ""), 10);
    const ratio = ratioIdx >= 0 ? parseFloat(row[ratioIdx]) : (buy > 0 ? buy / sell : null);

    if (isNaN(buy) || isNaN(sell)) continue;

    upsertRows.push({
      code,
      margin_buy: buy,
      margin_sell: sell,
      margin_ratio: isNaN(ratio as number) ? null : ratio,
      margin_date: reportDate,
    });
  }

  if (upsertRows.length === 0) {
    return NextResponse.json({ error: "パース結果0件", headers, sample: rows.slice(0, 3) }, { status: 422 });
  }

  const BATCH = 500;
  let updated = 0, errors = 0;
  for (let i = 0; i < upsertRows.length; i += BATCH) {
    const { error } = await db.from("screener_stocks").upsert(upsertRows.slice(i, i + BATCH));
    if (error) errors += Math.min(BATCH, upsertRows.length - i);
    else updated += Math.min(BATCH, upsertRows.length - i);
  }

  return NextResponse.json({
    ok: true, reportDate, usedDate,
    parsed: upsertRows.length, updated, errors,
    sampleCode: upsertRows[0]?.code,
  });
}
