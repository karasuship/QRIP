import { getSupabaseServer } from "@/lib/supabase";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type SignalEventType =
  | "phi2" | "rsi25" | "double" | "hyg8" | "b4"
  | "efa"  | "eem"   | "qqq"
  | "jp_buy"
  | "value_entry"
  | "news_mention"
  | "earnings_soon";

export type SignalSeverity = "critical" | "high" | "medium" | "low";
export type SignalColor    = "green" | "blue" | "yellow" | "purple" | "amber";

export interface SignalEvent {
  id: string;
  fired_at: string;
  date: string | null;
  type: SignalEventType;
  target: string;
  label: string;
  severity: SignalSeverity;
  color: SignalColor;
  value_num: number | null;
  value_label: string | null;
  detail: string | null;
}

export interface NewSignalEvent {
  type: SignalEventType;
  target: string;
  label: string;
  severity: SignalSeverity;
  color: SignalColor;
  value_num?: number | null;
  value_label?: string | null;
  detail?: string | null;
  date?: string | null;
}

// ── 色・重要度の定義（型ごとに統一） ─────────────────────────────────────────

export const SIGNAL_META: Record<SignalEventType, { color: SignalColor; severity: SignalSeverity; category: string }> = {
  double:        { color: "purple", severity: "critical", category: "相場シグナル" },
  phi2:          { color: "green",  severity: "high",     category: "相場シグナル" },
  rsi25:         { color: "green",  severity: "medium",   category: "相場シグナル" },
  hyg8:          { color: "green",  severity: "medium",   category: "相場シグナル" },
  b4:            { color: "green",  severity: "medium",   category: "相場シグナル" },
  efa:           { color: "green",  severity: "medium",   category: "相場シグナル" },
  eem:           { color: "green",  severity: "low",      category: "相場シグナル" },
  qqq:           { color: "amber",  severity: "medium",   category: "相場シグナル" },
  jp_buy:        { color: "green",  severity: "medium",   category: "日本株シグナル" },
  value_entry:   { color: "purple", severity: "low",      category: "バリュー株" },
  news_mention:  { color: "yellow", severity: "low",      category: "ニュース" },
  earnings_soon: { color: "blue",   severity: "medium",   category: "決算" },
};

// ── 書き込み ──────────────────────────────────────────────────────────────────

export async function writeSignalEvent(event: NewSignalEvent): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const { error } = await db.from("signal_events").insert(event);
  if (error) console.error("[signal-events] insert error:", error.message);
}

export async function writeSignalEvents(events: NewSignalEvent[]): Promise<void> {
  if (events.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const { error } = await db.from("signal_events").insert(events);
  if (error) console.error("[signal-events] batch insert error:", error.message);
}

// ── 読み取り ──────────────────────────────────────────────────────────────────

export async function fetchRecentSignalEvents(limit = 30): Promise<SignalEvent[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServer() as any;
  const { data } = await db
    .from("signal_events")
    .select("*")
    .order("fired_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as SignalEvent[];
}

// ── ヘルパー ──────────────────────────────────────────────────────────────────

export function pctLabel(n: number): string {
  const s = (n * 100).toFixed(2) + "%";
  return n >= 0 ? "+" + s : s;
}
