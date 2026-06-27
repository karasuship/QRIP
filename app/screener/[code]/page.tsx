import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchFinSummary } from "@/lib/jquants";
import StockDetail from "./StockDetail";

export const revalidate = 86400;

export async function generateMetadata(
  props: { params: Promise<{ code: string }> }
): Promise<Metadata> {
  const { code } = await props.params;
  return {
    title: `QRIP — ${code} 銘柄詳細`,
    description: `${code} の財務指標・推移チャート`,
  };
}

export interface TrendItem {
  year: string;
  salesOku: number | null;
  opOku: number | null;
  equityRatioPct: number | null;
}

export default async function StockPage(
  props: { params: Promise<{ code: string }> }
) {
  const { code } = await props.params;
  const db = getSupabaseServer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stock } = await (db as any)
    .from("screener_stocks")
    .select("*")
    .eq("code", code)
    .single();

  if (!stock) notFound();

  // 財務推移データ（失敗してもページは表示）
  let trend: TrendItem[] = [];
  try {
    const summaries = await fetchFinSummary(code);
    trend = summaries
      .sort((a, b) => a.CurFYEn.localeCompare(b.CurFYEn))
      .map((s) => ({
        year: s.CurFYEn.slice(0, 4),
        salesOku: s.Sales ? Math.round(Number(s.Sales) / 1e8) : null,
        opOku: s.OP ? Math.round(Number(s.OP) / 1e8) : null,
        equityRatioPct: s.EqAR ? Math.round(Number(s.EqAR) * 100) : null,
      }))
      .filter((t) => t.salesOku !== null || t.opOku !== null);
  } catch { /* データなし時はチャートを非表示 */ }

  return <StockDetail stock={stock} trend={trend} />;
}
