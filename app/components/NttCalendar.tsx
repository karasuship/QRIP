// NTT (9432) IR カレンダー
// 権利落ち日・配当支払・決算・株主総会
// 毎年更新が必要。日程は過去パターン + 推定

interface NttEvent {
  date: string;       // YYYY-MM-DD
  label: string;
  type: "exdate" | "dividend" | "earnings" | "agm";
  confirmed: boolean;
}

const EVENTS: NttEvent[] = [
  // ── 2026年 ──
  { date: "2026-06-26", label: "株主総会（第138期）",            type: "agm",      confirmed: false },
  { date: "2026-06-30", label: "期末配当支払（3月期・¥2.80/株）", type: "dividend", confirmed: false },
  { date: "2026-08-07", label: "第1四半期決算発表（推定）",        type: "earnings", confirmed: false },
  { date: "2026-09-28", label: "中間権利付き最終日",              type: "exdate",   confirmed: false },
  { date: "2026-09-29", label: "中間権利落ち日（権利確定: 9/30）", type: "exdate",   confirmed: false },
  { date: "2026-11-06", label: "中間決算発表（推定）",             type: "earnings", confirmed: false },
  { date: "2026-12-10", label: "中間配当支払（推定・¥2.50/株）",   type: "dividend", confirmed: false },
  // ── 2027年 ──
  { date: "2027-02-05", label: "第3四半期決算発表（推定）",        type: "earnings", confirmed: false },
  { date: "2027-03-26", label: "期末権利付き最終日（推定）",       type: "exdate",   confirmed: false },
  { date: "2027-03-27", label: "期末権利落ち日（推定）",           type: "exdate",   confirmed: false },
  { date: "2027-05-09", label: "通期決算発表（推定）",             type: "earnings", confirmed: false },
  { date: "2027-06-25", label: "株主総会（推定）",                type: "agm",      confirmed: false },
  { date: "2027-06-30", label: "期末配当支払（推定）",             type: "dividend", confirmed: false },
];

const TYPE_CONFIG = {
  exdate:   { label: "権利", color: "border-amber-400/30 text-amber-400" },
  dividend: { label: "配当", color: "border-[#34d399]/30 text-[#34d399]" },
  earnings: { label: "決算", color: "border-[#38bdf8]/30 text-[#38bdf8]" },
  agm:      { label: "総会", color: "border-violet-400/30 text-violet-400" },
};

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function NttCalendar() {
  const today = todayJst();
  const upcoming = EVENTS.filter((e) => e.date >= today).slice(0, 8);
  if (upcoming.length === 0) return null;

  const grouped = upcoming.reduce<Record<string, NttEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
        NTT IR カレンダー
      </p>
      <div className="space-y-2">
        {Object.entries(grouped).map(([date, events]) => {
          const d = new Date(date + "T00:00:00Z");
          const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
          const label = `${date.slice(5).replace("-", "/")}（${weekday}）`;
          const isToday = date === today;
          // 権利落ち日は特に目立たせる
          const hasExdate = events.some((e) => e.type === "exdate");
          return (
            <div key={date}>
              <p className={`font-mono text-[10px] mb-1 ${isToday ? "text-amber-400" : hasExdate ? "text-amber-400/70" : "text-slate-500"}`}>
                {isToday ? "▶ 今日 " : ""}{label}
              </p>
              <div className="space-y-1">
                {events.map((e) => {
                  const cfg = TYPE_CONFIG[e.type];
                  return (
                    <div
                      key={e.label}
                      className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.11] px-3 py-1.5"
                    >
                      <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-400 flex-1">{e.label}</span>
                      {!e.confirmed && (
                        <span className="font-mono text-[9px] text-slate-500 shrink-0">推定</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-500">
        権利落ち日は前営業日に保有が必要。配当・決算日程は推定。確定情報は NTT IR サイトで確認。
      </p>
    </div>
  );
}
