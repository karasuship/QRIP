"use client";

import { useState, useEffect, useCallback } from "react";
import LoginPrompt from "@/app/components/LoginPrompt";
import { getSupabaseBrowser } from "@/lib/supabase";

interface JournalEntry {
  id: number;
  entry_date: string;
  ticker: string | null;
  action: string;
  amount: number | null;
  crs_at_time: number | null;
  phi2_active: boolean;
  note: string | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  buy:  "買い",
  sell: "売り",
  note: "メモ",
};

const ACTION_COLOR: Record<string, string> = {
  buy:  "text-[#34d399] border-[#34d399]/30",
  sell: "text-[#f87171] border-[#f87171]/30",
  note: "text-slate-400 border-white/[0.15]",
};

const CRS_COLOR = (n: number | null) => {
  if (n === null) return "text-slate-500";
  if (n >= 5) return "text-[#f87171]";
  if (n >= 3) return "text-amber-400";
  if (n >= 2) return "text-[#38bdf8]";
  return "text-slate-500";
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export default function JournalClient({ todayCrs, todayPhi2 }: { todayCrs: number | null; todayPhi2: boolean }) {
  const [user, setUser] = useState<{ id: string } | null | "loading">("loading");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // form state
  const today = new Date().toISOString().slice(0, 10);
  const [fDate, setFDate] = useState(today);
  const [fTicker, setFTicker] = useState("");
  const [fAction, setFAction] = useState("buy");
  const [fAmount, setFAmount] = useState("");
  const [fCrs, setFCrs] = useState<string>(todayCrs !== null ? String(todayCrs) : "");
  const [fPhi2, setFPhi2] = useState(todayPhi2);
  const [fNote, setFNote] = useState("");

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) { setUser(null); return; }
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
  }, []);

  const fetchEntries = useCallback(async (uid: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    if (!sb) return;
    const { data } = await sb
      .from("investment_journal")
      .select("id, entry_date, ticker, action, amount, crs_at_time, phi2_active, note, created_at")
      .eq("user_id", uid)
      .order("entry_date", { ascending: false })
      .limit(100);
    if (data) setEntries(data as JournalEntry[]);
  }, []);

  useEffect(() => {
    if (user && user !== "loading") fetchEntries(user.id);
  }, [user, fetchEntries]);

  const save = async () => {
    if (!user || user === "loading") return;
    setSaving(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    if (!sb) { setSaving(false); return; }

    const { data } = await sb.from("investment_journal").insert({
      user_id: user.id,
      entry_date: fDate,
      ticker: fTicker.trim().toUpperCase() || null,
      action: fAction,
      amount: fAmount ? parseFloat(fAmount) : null,
      crs_at_time: fCrs !== "" ? parseInt(fCrs) : null,
      phi2_active: fPhi2,
      note: fNote.trim() || null,
    }).select().single();

    if (data) {
      setEntries((prev) => [data as JournalEntry, ...prev]);
      setShowForm(false);
      setFDate(today); setFTicker(""); setFAction("buy"); setFAmount("");
      setFCrs(todayCrs !== null ? String(todayCrs) : ""); setFPhi2(todayPhi2); setFNote("");
    }
    setSaving(false);
  };

  const deleteEntry = async (id: number) => {
    if (!confirm("この記録を削除しますか？")) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = getSupabaseBrowser() as any;
    if (!sb) return;
    await sb.from("investment_journal").delete().eq("id", id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  if (user === "loading") {
    return <p className="mt-12 font-mono text-xs text-slate-600 animate-pulse">● 読み込み中...</p>;
  }
  if (!user) {
    return <LoginPrompt next="/journal" />;
  }

  return (
    <div className="mt-6">
      {/* ツールバー */}
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] text-slate-500">{entries.length} 件の記録</p>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-3 py-1.5 font-mono text-[10px] text-[#34d399] hover:bg-[#34d399]/[0.14] transition-colors"
        >
          + 記録を追加
        </button>
      </div>

      {/* 追加フォーム */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-white/[0.12] bg-white/[0.05] p-5 space-y-3">
          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">新しい記録</p>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">日付</p>
              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]" />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">ティッカー</p>
              <input type="text" value={fTicker} onChange={(e) => setFTicker(e.target.value)}
                placeholder="VOO, 7203.T…"
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]" />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">アクション</p>
              <select value={fAction} onChange={(e) => setFAction(e.target.value)}
                className="w-full rounded-xl border border-white/[0.10] bg-[#0d1117] px-3 py-2 font-mono text-xs text-slate-200 outline-none focus:border-white/[0.25]">
                <option value="buy">買い</option>
                <option value="sell">売り</option>
                <option value="note">メモ</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">金額（円）</p>
              <input type="number" value={fAmount} onChange={(e) => setFAmount(e.target.value)}
                placeholder="100000"
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">CRS（当時）</p>
              <input type="number" min="0" max="6" value={fCrs} onChange={(e) => setFCrs(e.target.value)}
                placeholder="0〜6"
                className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2 font-mono text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25]" />
            </div>
            <div className="space-y-1">
              <p className="font-mono text-[9px] text-slate-600 uppercase">phi2 発動</p>
              <button
                onClick={() => setFPhi2((v) => !v)}
                className={`w-full rounded-xl border px-3 py-2 font-mono text-xs transition-colors ${fPhi2 ? "border-[#34d399]/40 bg-[#34d399]/[0.10] text-[#34d399]" : "border-white/[0.10] bg-white/[0.04] text-slate-600"}`}
              >
                {fPhi2 ? "✓ 発動中" : "未発動"}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <p className="font-mono text-[9px] text-slate-600 uppercase">メモ（なぜ買ったか・その時の感情）</p>
            <textarea value={fNote} onChange={(e) => setFNote(e.target.value)}
              rows={3} placeholder="暴落が怖かった。でも CRS=5 だったので購入した。後から見直すために記録する。"
              className="w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-white/[0.25] resize-none" />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="font-mono text-[10px] text-slate-600 hover:text-slate-400 px-3 py-2">キャンセル</button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.10] px-4 py-2 font-mono text-[10px] text-[#34d399] disabled:opacity-40 hover:bg-[#34d399]/[0.18] transition-colors"
            >
              {saving ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      )}

      {/* エントリー一覧 */}
      {entries.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8 text-center">
          <p className="font-mono text-xs text-slate-600">まだ記録がありません。最初の取引を記録しましょう。</p>
          <p className="mt-2 font-mono text-[10px] text-slate-700">暴落時に「なぜ買ったか」を残すのが最大の使い途。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[10px] text-slate-500">{fmt(e.entry_date)}</span>
                    <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] ${ACTION_COLOR[e.action] ?? "text-slate-400 border-white/[0.15]"}`}>
                      {ACTION_LABEL[e.action] ?? e.action}
                    </span>
                    {e.ticker && (
                      <span className="font-mono text-[10px] text-amber-400">{e.ticker}</span>
                    )}
                    {e.amount && (
                      <span className="font-mono text-[10px] text-slate-400">
                        ¥{e.amount.toLocaleString("ja-JP")}
                      </span>
                    )}
                    {e.crs_at_time !== null && (
                      <span className={`font-mono text-[10px] ${CRS_COLOR(e.crs_at_time)}`}>
                        CRS={e.crs_at_time}
                      </span>
                    )}
                    {e.phi2_active && (
                      <span className="font-mono text-[9px] text-[#34d399] border border-[#34d399]/30 rounded-full px-1.5 py-0.5">phi2</span>
                    )}
                  </div>
                  {e.note && (
                    <p className="text-xs leading-6 text-slate-400 whitespace-pre-wrap">{e.note}</p>
                  )}
                </div>
                <button
                  onClick={() => deleteEntry(e.id)}
                  className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-[#f87171] transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
