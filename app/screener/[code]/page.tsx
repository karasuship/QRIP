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

// ── 業種内ピア比較 ─────────────────────────────────────────────────────────────

export interface PeerRank {
  label: string;
  value: string;
  rank: number; // 0–100: 「自分より悪い銘柄の割合」→ 上位(100-rank)%
}

export interface PeerStats {
  sector: string;
  sectorCount: number;
  ranks: PeerRank[];
}

type PeerRow = {
  roe: number | null; roa: number | null;
  equity_ratio: number | null; operating_margin: number | null;
  pbr: number | null; dividend_yield: number | null;
};

function pRank(arr: (number | null)[], val: number | null, lowerBetter: boolean): number {
  if (val == null || !isFinite(val)) return -1;
  const valid = arr.filter((v): v is number => v != null && isFinite(v));
  if (valid.length < 5) return -1;
  return lowerBetter
    ? (valid.filter((v) => v > val).length / valid.length) * 100
    : (valid.filter((v) => v < val).length / valid.length) * 100;
}

function fmtPct(v: unknown, d = 1): string {
  const n = Number(v);
  return v == null || isNaN(n) ? "—" : (n * 100).toFixed(d) + "%";
}
function fmtNum(v: unknown, d = 1): string {
  const n = Number(v);
  return v == null || isNaN(n) ? "—" : n.toFixed(d) + "x";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildPeerStats(stock: any, peers: PeerRow[]): PeerStats | null {
  if (peers.length < 10) return null;
  const roes = peers.map((p) => p.roe);
  const roas = peers.map((p) => p.roa);
  const eqs  = peers.map((p) => p.equity_ratio);
  const oms  = peers.map((p) => p.operating_margin);
  const pbrs = peers.map((p) => p.pbr);
  const divs = peers.map((p) => p.dividend_yield);

  const ranks: PeerRank[] = [
    { label: "ROE",       value: fmtPct(stock.roe),              rank: pRank(roes, stock.roe,              false) },
    { label: "ROA",       value: fmtPct(stock.roa),              rank: pRank(roas, stock.roa,              false) },
    { label: "自己資本比率", value: fmtPct(stock.equity_ratio, 0),  rank: pRank(eqs,  stock.equity_ratio,    false) },
    { label: "営業利益率", value: fmtPct(stock.operating_margin),  rank: pRank(oms,  stock.operating_margin, false) },
    { label: "PBR 割安度", value: fmtNum(stock.pbr),              rank: pRank(pbrs, stock.pbr,              true)  },
    { label: "配当利回り", value: fmtPct(stock.dividend_yield),   rank: pRank(divs, stock.dividend_yield,   false) },
  ].filter((r) => r.rank >= 0);

  return { sector: String(stock.sector ?? ""), sectorCount: peers.length, ranks };
}

// ── 財務推移 ───────────────────────────────────────────────────────────────────

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

  // 財務データ・Yahoo データ・ピア比較を並行取得
  const [allSummaries, creds, peersRes] = await Promise.all([
    fetchFinSummary(code, false).catch(() => [] as JqFinSummary[]),
    getYahooCreds(),
    stock.sector
      ? db
          .from("screener_stocks")
          .select("roe,roa,equity_ratio,operating_margin,pbr,dividend_yield")
          .eq("sector", stock.sector)
      : Promise.resolve({ data: [] }),
  ]);

  const [calendar, chartData] = await Promise.all([
    fetchCalendarEvents(code4T, creds),
    fetchChartData(code4T, creds),
  ]);

  const trend = buildAnnualTrend(allSummaries);
  const quarterly = buildQuarterlyTrend(allSummaries);
  const peerStats = buildPeerStats(stock, (peersRes.data ?? []) as PeerRow[]);

  return (
    <StockDetail
      stock={stock}
      trend={trend}
      quarterly={quarterly}
      calendar={calendar}
      chartData={chartData}
      peerStats={peerStats}
    />
  );
}
