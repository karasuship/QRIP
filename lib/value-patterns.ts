import { getSupabaseServer } from "@/lib/supabase";

export interface ValueStock {
  code: string;
  name: string;
  market: string;
  price: number | null;
  pbr: number | null;
  per: number | null;
  roe: number | null;
  equity_ratio: number | null;
  operating_margin: number | null;
  dividend_yield: number | null;
  revenue_growth_yoy: number | null;
}

export interface ValuePattern {
  id: string;
  name: string;
  desc: string;
  basis: string;
  keyMetric: "pbr" | "dividend_yield" | "revenue_growth_yoy" | "operating_margin";
  keyLabel: string;
  screenerUrl: string;
  stocks: ValueStock[];
}

export async function fetchValuePatterns(): Promise<ValuePattern[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const sel = "code,name,market,price,pbr,per,roe,equity_ratio,operating_margin,dividend_yield,revenue_growth_yoy";

  const [graham, dividend, garp, cashflow] = await Promise.all([
    // グレアム型: PBR<1.0 + PER<15 + 自己資本比率>50%
    db.from("screener_stocks")
      .select(sel)
      .lte("pbr", 1.0)
      .lte("per", 15)
      .gte("equity_ratio", 0.50)
      .not("pbr", "is", null)
      .not("per", "is", null)
      .order("pbr", { ascending: true, nullsFirst: false })
      .limit(5),

    // 配当バリュー: 配当利回り>3.5% + ROE>8%
    db.from("screener_stocks")
      .select(sel)
      .gte("dividend_yield", 0.035)
      .gte("roe", 0.08)
      .not("dividend_yield", "is", null)
      .order("dividend_yield", { ascending: false, nullsFirst: false })
      .limit(5),

    // GARP: PER<20 + 売上成長率>10% + ROE>15%
    db.from("screener_stocks")
      .select(sel)
      .lte("per", 20)
      .gte("revenue_growth_yoy", 0.10)
      .gte("roe", 0.15)
      .not("revenue_growth_yoy", "is", null)
      .order("revenue_growth_yoy", { ascending: false, nullsFirst: false })
      .limit(5),

    // 高収益体質: 営業利益率>15% + PBR<1.5 + ROE>10%
    db.from("screener_stocks")
      .select(sel)
      .gte("operating_margin", 0.15)
      .lte("pbr", 1.5)
      .gte("roe", 0.10)
      .not("operating_margin", "is", null)
      .order("operating_margin", { ascending: false, nullsFirst: false })
      .limit(5),
  ]);

  return [
    {
      id: "graham",
      name: "グレアム型",
      desc: "資産より安く買える古典的割安株",
      basis: "PBR < 1.0 · PER < 15 · 自己資本比率 > 50%",
      keyMetric: "pbr",
      keyLabel: "PBR",
      screenerUrl: "/screener?pbr_max=1.0&per_max=15&equity_ratio_min=50",
      stocks: (graham.data ?? []) as ValueStock[],
    },
    {
      id: "dividend",
      name: "配当バリュー",
      desc: "配当が割安水準で、財務も健全な銘柄",
      basis: "配当利回り > 3.5% · ROE > 8%",
      keyMetric: "dividend_yield",
      keyLabel: "配当利回り",
      screenerUrl: "/screener?dividend_yield_min=3.5&roe_min=8",
      stocks: (dividend.data ?? []) as ValueStock[],
    },
    {
      id: "garp",
      name: "成長×割安（GARP）",
      desc: "成長しているのに、まだ割高でない銘柄",
      basis: "PER < 20 · 売上成長率 > 10% · ROE > 15%",
      keyMetric: "revenue_growth_yoy",
      keyLabel: "売上成長率",
      screenerUrl: "/screener?per_max=20&roe_min=15",
      stocks: (garp.data ?? []) as ValueStock[],
    },
    {
      id: "cashflow",
      name: "高収益体質",
      desc: "稼ぐ力が強いのに、まだ割高でない銘柄",
      basis: "営業利益率 > 15% · PBR < 1.5 · ROE > 10%",
      keyMetric: "operating_margin",
      keyLabel: "営業利益率",
      screenerUrl: "/screener?operating_margin_min=15&pbr_max=1.5&roe_min=10",
      stocks: (cashflow.data ?? []) as ValueStock[],
    },
  ];
}
