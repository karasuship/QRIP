import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchFinSummary, type JqFinSummary } from "@/lib/jquants";
import { getYahooCreds, fetchCalendarEvents, fetchChartData } from "@/lib/yahoo-finance";
import type { StockCalendar, ChartData } from "@/lib/yahoo-finance";
import StockDetail from "./StockDetail";

export { type StockCalendar, type ChartData };
export type { DividendEvent } from "@/lib/yahoo-finance";

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

export interface QuarterlyItem {
  label: string;
  salesOku: number | null;
  opOku: number | null;
}

function buildAnnualTrend(summaries: JqFinSummary[]): TrendItem[] {
  return summaries
    .filter((s) => s.CurPerType === "FY")
    .sort((a, b) => a.CurFYEn.localeCompare(b.CurFYEn))
    .map((s) => ({
      year: s.CurFYEn.slice(0, 4),
      salesOku: s.Sales ? Math.round(Number(s.Sales) / 1e8) : null,
      opOku: s.OP ? Math.round(Number(s.OP) / 1e8) : null,
      equityRatioPct: s.EqAR ? Math.round(Number(s.EqAR) * 100) : null,
    }))
    .filter((t) => t.salesOku !== null || t.opOku !== null);
}

const PERIOD_LABEL: Record<string, string> = {
  "1Q": "Q1", "2Q": "上半", "3Q": "Q3累", "4Q": "Q4累",
};

function buildQuarterlyTrend(summaries: JqFinSummary[]): QuarterlyItem[] {
  return summaries
    .filter((s) => s.CurPerType !== "FY" && PERIOD_LABEL[s.CurPerType])
    .sort((a, b) => a.CurFYEn.localeCompare(b.CurFYEn) || a.CurPerType.localeCompare(b.CurPerType))
    .slice(-8)
    .map((s) => ({
      label: `${s.CurFYEn.slice(2, 4)}/${PERIOD_LABEL[s.CurPerType]}`,
      salesOku: s.Sales ? Math.round(Number(s.Sales) / 1e8) : null,
      opOku: s.OP ? Math.round(Number(s.OP) / 1e8) : null,
    }))
    .filter((t) => t.salesOku !== null || t.opOku !== null);
}

export default async function StockPage(
  props: { params: Promise<{ code: string }> }
) {
  const { code } = await props.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;

  const { data: stock } = await db
    .from("screener_stocks")
    .select("*")
    .eq("code", code)
    .single();

  if (!stock) notFound();

  const code4T = code.slice(0, 4) + ".T";

  // 財務データ・Yahoo データを並行取得（失敗���ても表示は続く）
  const [allSummaries, creds] = await Promise.all([
    fetchFinSummary(code, false).catch(() => [] as JqFinSummary[]),
    getYahooCreds(),
  ]);

  const [calendar, chartData] = await Promise.all([
    fetchCalendarEvents(code4T, creds),
    fetchChartData(code4T, creds),
  ]);

  const trend = buildAnnualTrend(allSummaries);
  const quarterly = buildQuarterlyTrend(allSummaries);

  return (
    <StockDetail
      stock={stock}
      trend={trend}
      quarterly={quarterly}
      calendar={calendar}
      chartData={chartData}
    />
  );
}
