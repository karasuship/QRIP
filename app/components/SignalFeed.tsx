import Link from "next/link";
import { fetchRecentSignalEvents } from "@/lib/signal-events";
import type { SignalEvent, SignalColor } from "@/lib/signal-events";

const COLOR_CLS: Record<SignalColor, { border: string; dot: string; badge: string }> = {
  green:  { border: "border-[#34d399]/25",  dot: "bg-[#34d399]",  badge: "bg-[#34d399]/10 text-[#34d399] border-[#34d399]/30" },
  purple: { border: "border-violet-400/25", dot: "bg-violet-400", badge: "bg-violet-400/10 text-violet-300 border-violet-400/30" },
  blue:   { border: "border-[#38bdf8]/25",  dot: "bg-[#38bdf8]",  badge: "bg-[#38bdf8]/10 text-[#38bdf8] border-[#38bdf8]/30" },
  yellow: { border: "border-amber-300/25",  dot: "bg-amber-300",  badge: "bg-amber-300/10 text-amber-300 border-amber-300/30" },
  amber:  { border: "border-amber-400/25",  dot: "bg-amber-400",  badge: "bg-amber-400/10 text-amber-400 border-amber-400/30" },
};

const TARGET_HREF: Record<string, string> = {
  "^GSPC": "/signal/sp500",
  "EFA":   "/signal/efa",
  "EEM":   "/signal/eem",
  "QQQ":   "/signal/qqq",
  "VT":    "/signal/vt",
  "9432.T": "/signal/ntt",
  "2914.T": "/signal/jt",
  "9433.T": "/signal/kddi",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60)     return `${diff}秒前`;
  if (diff < 3600)   return `${Math.floor(diff / 60)}分前`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}時間前`;
  return `${Math.floor(diff / 86400)}日前`;
}

function EventRow({ e }: { e: SignalEvent }) {
  const c = COLOR_CLS[e.color];
  const href = TARGET_HREF[e.target] ?? (e.target.includes(".T") ? `/screener/${e.target.replace(".T", "")}` : null);

  const inner = (
    <div className={`flex items-center gap-3 rounded-xl border ${c.border} bg-white/[0.02] px-4 py-2.5 hover:bg-white/[0.04] transition-colors`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${c.dot}`} />
      <div className="flex-1 min-w-0">
        <span className="text-[12px] font-medium text-slate-300">{e.label}</span>
        {e.value_label && (
          <span className={`ml-2 rounded border px-1.5 py-0.5 font-mono text-[9px] font-bold ${c.badge}`}>
            {e.value_label}
          </span>
        )}
        {e.detail && (
          <p className="mt-0.5 font-mono text-[9px] text-slate-600 truncate">{e.detail}</p>
        )}
      </div>
      <span className="font-mono text-[9px] text-slate-600 shrink-0">{timeAgo(e.fired_at)}</span>
    </div>
  );

  if (href) return <Link href={href} className="block">{inner}</Link>;
  return <div>{inner}</div>;
}

interface Props {
  limit?: number;
  showHeader?: boolean;
}

export async function SignalFeed({ limit = 10, showHeader = true }: Props) {
  let events: SignalEvent[] = [];
  try {
    events = await fetchRecentSignalEvents(limit);
  } catch { /* テーブル未作成時は非表示 */ }

  if (events.length === 0) return null;

  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#34d399] opacity-60" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#34d399]" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-widest text-slate-500">最近のシグナル</span>
        </div>
      )}
      <div className="space-y-1.5">
        {events.map((e) => <EventRow key={e.id} e={e} />)}
      </div>
    </div>
  );
}
