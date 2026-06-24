import { fetchMarketContext, type MarketQuote } from "@/lib/market-fetch";

function fmt(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100)   return price.toFixed(2);
  return price.toFixed(3);
}

function QuoteCard({ q }: { q: MarketQuote }) {
  const up = q.changePct >= 0;
  const color  = up ? "text-[#34d399]" : "text-[#f87171]";
  const border = up ? "border-[#34d399]/20 bg-[#34d399]/[0.05]" : "border-[#f87171]/20 bg-[#f87171]/[0.05]";
  return (
    <div className={`rounded-xl border px-3 py-2.5 ${border}`}>
      <p className="font-mono text-[10px] text-slate-400 truncate">{q.label}</p>
      <p className={`font-mono text-sm font-bold mt-0.5 ${color}`}>
        {(up ? "+" : "") + q.changePct.toFixed(2)}%
      </p>
      <p className="font-mono text-[10px] text-slate-500">{fmt(q.price)}</p>
    </div>
  );
}

export default async function MarketContext() {
  const quotes = await fetchMarketContext().catch(() => [] as MarketQuote[]);
  if (quotes.length === 0) return null;

  const equities   = quotes.filter((q) => q.category === "equity");
  const commodities = quotes.filter((q) => q.category === "commodity");

  return (
    <section className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.06] p-4 backdrop-blur-md">
      <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-400">
        市場文脈 — 今日の主要指数
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[...equities, ...commodities].map((q) => (
          <QuoteCard key={q.symbol} q={q} />
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[9px] leading-4 text-slate-600">
        NASDAQ100（テック/成長）·
        ラッセル2000（小型株・信用感応度高い）·
        KOSPI（グローバルリスクの先行指標）·
        金（逃避先）·
        原油（需要期待）
      </p>
    </section>
  );
}
