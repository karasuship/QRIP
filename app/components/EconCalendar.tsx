// 経済カレンダー — 直近の重要イベント（毎月手動更新）
// 時刻は日本時間（JST）

interface CalEvent {
  date: string;   // YYYY-MM-DD
  time: string;   // HH:MM JST
  label: string;
  importance: "high" | "mid";
  market: "US" | "JP" | "GL";
}

const EVENTS: CalEvent[] = [
  // ── 6/25 ──
  { date: "2026-06-25", time: "21:30", label: "米 PCE デフレーター（5月）",    importance: "high", market: "US" },
  { date: "2026-06-25", time: "21:30", label: "米 GDP 改定値（1-3月期）",      importance: "high", market: "US" },
  { date: "2026-06-25", time: "21:30", label: "米 耐久財受注（5月）",           importance: "mid",  market: "US" },
  // ── 6/26 ──
  { date: "2026-06-26", time: "08:30", label: "東京 CPI（6月）",               importance: "mid",  market: "JP" },
  // ── 6/30 ──
  { date: "2026-06-30", time: "10:30", label: "中国 製造業 PMI（6月）",        importance: "mid",  market: "GL" },
  { date: "2026-06-30", time: "23:00", label: "米 消費者信頼感（6月）",         importance: "mid",  market: "US" },
  { date: "2026-06-30", time: "23:00", label: "米 JOLTS 求人（5月）",          importance: "mid",  market: "US" },
  // ── 7/1 ──
  { date: "2026-07-01", time: "08:50", label: "日銀 短観（6月）",              importance: "high", market: "JP" },
  { date: "2026-07-01", time: "21:15", label: "米 ADP 雇用統計（6月）",        importance: "high", market: "US" },
  { date: "2026-07-01", time: "23:00", label: "米 ISM 製造業（6月）",          importance: "high", market: "US" },
  // ── 7/2 ──
  { date: "2026-07-02", time: "21:30", label: "米 雇用統計（6月）",            importance: "high", market: "US" },
  // ── 7/3 ──
  { date: "2026-07-03", time: "—",     label: "米国 休場（独立記念日）",        importance: "mid",  market: "US" },
];

const MARKET_LABEL: Record<string, string> = { US: "米", JP: "日", GL: "中" };
const MARKET_COLOR: Record<string, string> = {
  US: "border-[#38bdf8]/30 text-[#38bdf8]",
  JP: "border-[#34d399]/30 text-[#34d399]",
  GL: "border-amber-400/30 text-amber-400",
};

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function EconCalendar() {
  const today = todayJst();
  const upcoming = EVENTS.filter((e) => e.date >= today);
  if (upcoming.length === 0) return null;

  // グループ化（日付ごと）
  const grouped = upcoming.reduce<Record<string, CalEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <section className="mt-8 border-t border-white/[0.12] pt-6">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">
        今後の主要イベント
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
                    key={e.label}
                    className="flex items-center gap-2.5 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-1.5"
                  >
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${MARKET_COLOR[e.market]}`}>
                      {MARKET_LABEL[e.market]}
                    </span>
                    <span className="font-mono text-[10px] text-slate-500 shrink-0 w-10">{e.time}</span>
                    <span className={`text-xs ${e.importance === "high" ? "text-[#e8f4ff]" : "text-slate-400"}`}>
                      {e.label}
                    </span>
                    {e.importance === "high" && (
                      <span className="ml-auto shrink-0 font-mono text-[9px] text-amber-400">重要</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-600">
        時刻は JST。PCE・雇用統計・ISM は SP500 の急変動を引き起こしやすい。
      </p>
    </section>
  );
}
