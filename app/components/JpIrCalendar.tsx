// 日本株 統合 IR カレンダー（NTT · JT · KDDI）
// 権利落ち日・配当支払・決算・株主総会
// 日程はパターン推定。確定情報は各社 IR サイトを参照。

interface JpEvent {
  date: string;
  stock: "NTT" | "JT" | "KDDI" | "ALL";
  label: string;
  type: "exdate" | "dividend" | "earnings" | "agm";
  confirmed: boolean;
}

const EVENTS: JpEvent[] = [
  // ── 2026年 ──

  // JT (2914) — 決算期: 12月末 / 権利確定: 6月末・12月末
  { date: "2026-06-29", stock: "JT",   label: "JT 中間権利落ち日（6月末権利確定）",     type: "exdate",   confirmed: false },
  { date: "2026-06-30", stock: "NTT",  label: "NTT 期末配当支払（¥2.80/株・推定）",      type: "dividend", confirmed: false },
  { date: "2026-08-05", stock: "JT",   label: "JT 第2四半期決算発表（推定）",             type: "earnings", confirmed: false },
  { date: "2026-08-07", stock: "NTT",  label: "NTT 第1四半期決算発表（推定）",            type: "earnings", confirmed: false },
  { date: "2026-08-09", stock: "KDDI", label: "KDDI 第1四半期決算発表（推定）",           type: "earnings", confirmed: false },
  { date: "2026-09-28", stock: "KDDI", label: "KDDI 中間権利付き最終日",                  type: "exdate",   confirmed: false },
  { date: "2026-09-29", stock: "NTT",  label: "NTT 中間権利落ち日（9月末権利確定）",      type: "exdate",   confirmed: false },
  { date: "2026-09-29", stock: "KDDI", label: "KDDI 中間権利落ち日（9月末権利確定）",     type: "exdate",   confirmed: false },
  { date: "2026-11-06", stock: "NTT",  label: "NTT 中間決算発表（推定）",                 type: "earnings", confirmed: false },
  { date: "2026-11-08", stock: "KDDI", label: "KDDI 中間決算発表（推定）",                type: "earnings", confirmed: false },
  { date: "2026-12-10", stock: "NTT",  label: "NTT 中間配当支払（¥2.50/株・推定）",       type: "dividend", confirmed: false },
  { date: "2026-12-10", stock: "KDDI", label: "KDDI 中間配当支払（¥72.5/株・推定）",      type: "dividend", confirmed: false },
  { date: "2026-12-29", stock: "JT",   label: "JT 期末権利落ち日（12月末権利確定）",       type: "exdate",   confirmed: false },
  // ── 2027年 ──
  { date: "2027-02-05", stock: "JT",   label: "JT 通期決算発表（推定）",                  type: "earnings", confirmed: false },
  { date: "2027-02-05", stock: "NTT",  label: "NTT 第3四半期決算発表（推定）",             type: "earnings", confirmed: false },
  { date: "2027-02-07", stock: "KDDI", label: "KDDI 第3四半期決算発表（推定）",            type: "earnings", confirmed: false },
  { date: "2027-03-05", stock: "JT",   label: "JT 株主総会（推定）",                      type: "agm",      confirmed: false },
  { date: "2027-03-10", stock: "JT",   label: "JT 期末配当支払（推定）",                   type: "dividend", confirmed: false },
  { date: "2027-03-26", stock: "KDDI", label: "KDDI 期末権利付き最終日（推定）",            type: "exdate",   confirmed: false },
  { date: "2027-03-27", stock: "NTT",  label: "NTT 期末権利落ち日（推定）",               type: "exdate",   confirmed: false },
  { date: "2027-03-27", stock: "KDDI", label: "KDDI 期末権利落ち日（推定）",              type: "exdate",   confirmed: false },
  { date: "2027-05-09", stock: "NTT",  label: "NTT 通期決算発表（推定）",                 type: "earnings", confirmed: false },
  { date: "2027-05-09", stock: "KDDI", label: "KDDI 通期決算発表（推定）",                type: "earnings", confirmed: false },
  { date: "2027-06-24", stock: "KDDI", label: "KDDI 株主総会（推定）",                    type: "agm",      confirmed: false },
  { date: "2027-06-25", stock: "NTT",  label: "NTT 株主総会（推定）",                     type: "agm",      confirmed: false },
  { date: "2027-06-30", stock: "NTT",  label: "NTT 期末配当支払（推定）",                  type: "dividend", confirmed: false },
  { date: "2027-06-30", stock: "KDDI", label: "KDDI 期末配当支払（推定）",                 type: "dividend", confirmed: false },
];

const TYPE_CONFIG = {
  exdate:   { label: "権利", color: "border-amber-400/30 text-amber-400" },
  dividend: { label: "配当", color: "border-[#34d399]/30 text-[#34d399]" },
  earnings: { label: "決算", color: "border-[#38bdf8]/30 text-[#38bdf8]" },
  agm:      { label: "総会", color: "border-violet-400/30 text-violet-400" },
};

const STOCK_COLOR: Record<string, string> = {
  NTT:  "border-[#34d399]/20 text-[#34d399]/70",
  JT:   "border-amber-400/20 text-amber-400/70",
  KDDI: "border-[#38bdf8]/20 text-[#38bdf8]/70",
  ALL:  "border-white/10 text-slate-500",
};

function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export default function JpIrCalendar({ stock }: { stock?: "NTT" | "JT" | "KDDI" }) {
  const today = todayJst();
  const filtered = stock ? EVENTS.filter((e) => e.stock === stock || e.stock === "ALL") : EVENTS;
  const upcoming = filtered.filter((e) => e.date >= today).slice(0, 12);
  if (upcoming.length === 0) return null;

  const grouped = upcoming.reduce<Record<string, JpEvent[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
        IR カレンダー — NTT · JT · KDDI
      </p>
      <div className="space-y-2">
        {Object.entries(grouped).map(([date, events]) => {
          const d = new Date(date + "T00:00:00Z");
          const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getUTCDay()];
          const mmdd = date.slice(5).replace("-", "/");
          const isToday = date === today;
          return (
            <div key={date}>
              <p className={`font-mono text-[10px] mb-1 ${isToday ? "text-amber-400" : "text-slate-600"}`}>
                {isToday ? "▶ 今日 " : ""}{mmdd}（{weekday}）
              </p>
              <div className="space-y-1">
                {events.map((e) => (
                  <div
                    key={e.label}
                    className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-1.5"
                  >
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${STOCK_COLOR[e.stock]}`}>
                      {e.stock}
                    </span>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[9px] ${TYPE_CONFIG[e.type].color}`}>
                      {TYPE_CONFIG[e.type].label}
                    </span>
                    <span className="text-xs text-slate-400 flex-1">{e.label}</span>
                    {!e.confirmed && (
                      <span className="font-mono text-[9px] text-slate-700 shrink-0">推定</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 font-mono text-[9px] text-slate-700">
        推定日程は過去パターンから計算。権利落ち日は前日までの保有が必要。
        確定情報は各社 IR サイトで確認。
      </p>
    </div>
  );
}
