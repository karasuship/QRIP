// 決算カレンダー — 主要 SP500 企業の次回決算予定（Q2 2026、四半期ごとに更新）
// 日程は過去パターンから推定。confirmed: true のものだけが公式発表済み
// BMO = 市場開始前 / AMC = 引け後

interface EarningsEvent {
  date: string;
  ticker: string;
  name: string;
  when: "BMO" | "AMC" | "—";
  confirmed: boolean;
  sector: "finance" | "tech" | "consumer" | "health";
}

const EARNINGS: EarningsEvent[] = [
  // ── 7/14 ──
  { date: "2026-07-14", ticker: "JPM",   name: "JPMorgan Chase",  when: "BMO", confirmed: false, sector: "finance" },
  { date: "2026-07-14", ticker: "GS",    name: "Goldman Sachs",   when: "BMO", confirmed: false, sector: "finance" },
  { date: "2026-07-14", ticker: "WFC",   name: "Wells Fargo",     when: "BMO", confirmed: false, sector: "finance" },
  // ── 7/15 ──
  { date: "2026-07-15", ticker: "BAC",   name: "Bank of America", when: "BMO", confirmed: false, sector: "finance" },
  { date: "2026-07-15", ticker: "C",     name: "Citigroup",       when: "BMO", confirmed: false, sector: "finance" },
  { date: "2026-07-15", ticker: "UNH",   name: "UnitedHealth",    when: "BMO", confirmed: false, sector: "health"  },
  // ── 7/17 ──
  { date: "2026-07-17", ticker: "NFLX",  name: "Netflix",         when: "AMC", confirmed: false, sector: "tech"    },
  // ── 7/22 ──
  { date: "2026-07-22", ticker: "TSLA",  name: "Tesla",           when: "AMC", confirmed: false, sector: "consumer"},
  // ── 7/28 ──
  { date: "2026-07-28", ticker: "GOOGL", name: "Alphabet",        when: "AMC", confirmed: false, sector: "tech"    },
  // ── 7/29 ──
  { date: "2026-07-29", ticker: "META",  name: "Meta",            when: "AMC", confirmed: false, sector: "tech"    },
  { date: "2026-07-29", ticker: "MSFT",  name: "Microsoft",       when: "AMC", confirmed: false, sector: "tech"    },
  // ── 7/31 ──
  { date: "2026-07-31", ticker: "AAPL",  name: "Apple",           when: "AMC", confirmed: false, sector: "tech"    },
  { date: "2026-07-31", ticker: "AMZN",  name: "Amazon",          when: "AMC", confirmed: false, sector: "tech"    },
  // ── 8/27 ──
  { date: "2026-08-27", ticker: "NVDA",  name: "NVIDIA",          when: "AMC", confirmed: false, sector: "tech"    },
];

const SECTOR_COLOR: Record<string, string> = {
  finance:  "border-[#38bdf8]/30 text-[#38bdf8]",
  tech:     "border-violet-400/30 text-violet-400",
  consumer: "border-amber-400/30 text-amber-400",
  health:   "border-[#34d399]/30 text-[#34d399]",
};

const WHEN_LABEL: Record<string, string> = { BMO: "朝前", AMC: "引後", "—": "—" };

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function EarningsCalendar() {
  const today = todayJst();
  const upcoming = EARNINGS.filter((e) => e.date >= today);
  if (upcoming.length === 0) return null;

  const grouped = upcoming.reduce<Record<string, EarningsEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="mt-6 border-t border-white/[0.07] pt-5">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
        主要企業 決算（Q2 2026）
      </p>
      <div className="space-y-3">
        {Object.entries(grouped).map(([date, events]) => {
          const d = new Date(date + "T00:00:00Z");
          const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
          const label = `${date.slice(5).replace("-", "/")}（${weekday}）`;
          const isToday = date === today;
          return (
            <div key={date}>
              <p className={`font-mono text-[10px] mb-1.5 ${isToday ? "text-amber-400" : "text-slate-500"}`}>
                {isToday ? "▶ 今日 " : ""}{label}
              </p>
              <div className="space-y-1">
                {events.map((e) => (
                  <div
                    key={e.ticker}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.11] px-3 py-1.5"
                  >
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${SECTOR_COLOR[e.sector]}`}>
                      {e.ticker}
                    </span>
                    <span className="text-xs text-slate-400 flex-1">{e.name}</span>
                    <span className="font-mono text-[9px] text-slate-500 shrink-0">
                      {WHEN_LABEL[e.when]}
                    </span>
                    {!e.confirmed && (
                      <span className="font-mono text-[9px] text-slate-500 shrink-0">推定</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-500">
        朝前 = 市場開始前 / 引後 = 引け後。推定日程は過去パターン推定・未公式発表。GAFAM 決算週は SP500 大幅変動に注意。
      </p>
    </div>
  );
}
