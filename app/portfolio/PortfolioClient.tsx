"use client";

import { useState, useEffect, useCallback } from "react";

// ─── 型 ─────────────────────────────────────────────
interface Entry {
  id: string;
  date: string;
  amount: number;       // 投入額（円）
  sp500Level: number;   // 購入時 SP500
  type: "phi2" | "dca" | "other";
  label: string;        // 任意メモ
}

interface Props {
  currentPrice: number;
  currentDate: string;
}

const STORAGE_KEY = "qrip_portfolio_v2";

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

function fmt(n: number, digits = 0) {
  return n.toLocaleString("ja-JP", { maximumFractionDigits: digits });
}

function fmtPct(n: number) {
  const s = (n * 100).toFixed(1) + "%";
  return n >= 0 ? "+" + s : s;
}

// ─── メインコンポーネント ────────────────────────────
export default function PortfolioClient({ currentPrice, currentDate }: Props) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [form, setForm] = useState({ date: "", amount: "", type: "phi2" as Entry["type"], label: "" });
  const [loadingPrice, setLoadingPrice] = useState(false);
  const [fetchedLevel, setFetchedLevel] = useState<{ date: string; price: number } | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"summary" | "log">("summary");

  // localStorage 読み込み
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setEntries(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // localStorage 書き込み
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }, [entries]);

  // 日付が変わったら SP500 価格を取得
  const fetchPrice = useCallback(async (date: string) => {
    if (!date) return;
    setLoadingPrice(true);
    setFetchedLevel(null);
    try {
      const res = await fetch(`/api/sp500-price?date=${date}`);
      const json = await res.json();
      if (json.price) setFetchedLevel(json);
      else setError("その日の価格が取得できませんでした");
    } catch {
      setError("価格取得に失敗しました");
    } finally {
      setLoadingPrice(false);
    }
  }, []);

  // エントリー追加
  function addEntry() {
    setError("");
    const amount = Number(form.amount);
    if (!form.date || amount <= 0) { setError("日付と金額を入力してください"); return; }
    if (!fetchedLevel) { setError("SP500 価格を取得中か取得済みである必要があります"); return; }
    setEntries((prev) => [
      ...prev,
      {
        id: genId(),
        date: form.date,
        amount,
        sp500Level: fetchedLevel.price,
        type: form.type,
        label: form.label,
      },
    ]);
    setForm({ date: "", amount: "", type: "phi2", label: "" });
    setFetchedLevel(null);
  }

  function removeEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  // ─── 集計 ───────────────────────────────────────────
  const totalInvested = entries.reduce((s, e) => s + e.amount, 0);
  const totalCurrentValue = entries.reduce((s, e) => {
    return s + e.amount * (currentPrice / e.sp500Level);
  }, 0);
  const totalPnl = totalCurrentValue - totalInvested;
  const totalReturn = totalInvested > 0 ? totalPnl / totalInvested : 0;

  // phi2 エントリーのみの集計
  const phi2Entries = entries.filter((e) => e.type === "phi2");
  const phi2Invested = phi2Entries.reduce((s, e) => s + e.amount, 0);
  const phi2CurrentValue = phi2Entries.reduce((s, e) => s + e.amount * (currentPrice / e.sp500Level), 0);
  const phi2Return = phi2Invested > 0 ? (phi2CurrentValue - phi2Invested) / phi2Invested : 0;

  // DCA ベースライン（同額を SP500 現在価格で一括購入した場合との比較）
  // ここでは最も古い購入日からの平均 SP500 レベルを参照
  const avgBuyLevel = entries.length > 0
    ? entries.reduce((s, e) => s + e.sp500Level * e.amount, 0) / totalInvested
    : 0;
  const dcaReturn = avgBuyLevel > 0 ? (currentPrice / avgBuyLevel) - 1 : 0;
  const signalAlpha = totalReturn - dcaReturn;

  const TYPE_LABEL: Record<Entry["type"], string> = { phi2: "phi2", dca: "DCA", other: "その他" };
  const TYPE_COLOR: Record<Entry["type"], string> = {
    phi2: "text-[#34d399]", dca: "text-[#38bdf8]", other: "text-slate-400",
  };

  return (
    <div className="space-y-4">
      {/* タブ */}
      <div className="flex gap-1 rounded-xl border border-white/[0.18] bg-white/[0.14] p-1 w-fit">
        {(["summary", "log"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 font-mono text-xs transition-colors ${
              tab === t ? "bg-white/[0.10] text-[#e8f4ff]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "summary" ? "サマリー" : "売買ログ"}
          </button>
        ))}
      </div>

      {/* ─── サマリー ─── */}
      {tab === "summary" && (
        <div className="space-y-3">
          {entries.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] px-5 py-8 text-center">
              <p className="font-mono text-xs text-slate-500">まだ記録がありません。「売買ログ」タブから追加してください。</p>
            </div>
          ) : (
            <>
              {/* 総合 P&L */}
              <div className="rounded-2xl border border-white/[0.18] bg-white/[0.09] p-5 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">総合損益</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {[
                    { label: "投入総額", value: `¥${fmt(totalInvested)}`, color: "text-slate-300" },
                    { label: "現在評価額", value: `¥${fmt(totalCurrentValue)}`, color: "text-[#e8f4ff]" },
                    { label: "損益", value: `¥${fmt(totalPnl)}`, color: totalPnl >= 0 ? "text-[#34d399]" : "text-[#f87171]" },
                    { label: "リターン", value: fmtPct(totalReturn), color: totalReturn >= 0 ? "text-[#34d399]" : "text-[#f87171]" },
                  ].map((c) => (
                    <div key={c.label} className="rounded-xl border border-white/[0.09] bg-white/[0.14] p-3">
                      <p className="font-mono text-[9px] text-slate-500 mb-1">{c.label}</p>
                      <p className={`font-mono text-base font-bold tabular-nums ${c.color}`}>{c.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* phi2 vs DCA 比較 */}
              <div className="rounded-2xl border border-white/[0.22] bg-white/[0.11] p-4 backdrop-blur-md">
                <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">phi2 シグナル vs DCAベースライン</p>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">phi2 シグナル購入のリターン</span>
                    <span className={`font-mono text-sm font-semibold ${phi2Return >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                      {phi2Invested > 0 ? fmtPct(phi2Return) : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400">加重平均買値ベースのDCA換算リターン</span>
                    <span className={`font-mono text-sm font-semibold ${dcaReturn >= 0 ? "text-[#38bdf8]" : "text-[#f87171]"}`}>
                      {fmtPct(dcaReturn)}
                    </span>
                  </div>
                  <div className="border-t border-white/[0.09] pt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">シグナルアルファ（差分）</span>
                    <span className={`font-mono text-sm font-bold ${signalAlpha >= 0 ? "text-violet-300" : "text-[#f87171]"}`}>
                      {fmtPct(signalAlpha)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 font-mono text-[9px] text-slate-500">
                  SP500 現在値: {fmt(currentPrice, 2)} ({currentDate}) · 加重平均買値: {avgBuyLevel > 0 ? fmt(avgBuyLevel, 2) : "—"}
                </p>
              </div>

              {/* タイプ別内訳 */}
              {(["phi2", "dca", "other"] as Entry["type"][]).map((t) => {
                const es = entries.filter((e) => e.type === t);
                if (es.length === 0) return null;
                const inv = es.reduce((s, e) => s + e.amount, 0);
                const cur = es.reduce((s, e) => s + e.amount * (currentPrice / e.sp500Level), 0);
                const ret = (cur - inv) / inv;
                return (
                  <div key={t} className="flex items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.14] px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className={`font-mono text-xs font-semibold ${TYPE_COLOR[t]}`}>{TYPE_LABEL[t]}</span>
                      <span className="font-mono text-[10px] text-slate-500">{es.length}件 · ¥{fmt(inv)}</span>
                    </div>
                    <span className={`font-mono text-sm font-semibold ${ret >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>{fmtPct(ret)}</span>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ─── 売買ログ ─── */}
      {tab === "log" && (
        <div className="space-y-4">
          {/* 入力フォーム */}
          <div className="rounded-2xl border border-white/[0.18] bg-white/[0.09] p-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">購入を記録</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <label className="font-mono text-[10px] text-slate-500 block mb-1">購入日</label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => { setForm((f) => ({ ...f, date: e.target.value })); fetchPrice(e.target.value); }}
                  className="w-full rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-slate-500 block mb-1">
                  SP500 価格{" "}
                  {loadingPrice && <span className="text-slate-500">取得中…</span>}
                  {fetchedLevel && <span className="text-[#34d399]">{fetchedLevel.date}: {fmt(fetchedLevel.price, 2)}</span>}
                </label>
                <input
                  type="text"
                  readOnly
                  value={fetchedLevel ? String(fetchedLevel.price) : ""}
                  placeholder="日付選択で自動取得"
                  className="w-full rounded-xl border border-white/[0.18] bg-white/[0.11] px-3 py-2 font-mono text-sm text-slate-400 outline-none"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-slate-500 block mb-1">投入額（円）</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="例: 30000"
                  className="w-full rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[10px] text-slate-500 block mb-1">種別</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as Entry["type"] }))}
                  className="w-full rounded-xl border border-white/[0.15] bg-[#020c1b] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
                >
                  <option value="phi2">phi2 シグナル</option>
                  <option value="dca">定期 DCA</option>
                  <option value="other">その他</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="font-mono text-[10px] text-slate-500 block mb-1">メモ（任意）</label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="例: コロナ暴落時"
                  className="w-full rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
                />
              </div>
            </div>
            {error && <p className="mt-2 font-mono text-xs text-red-400">{error}</p>}
            <button
              onClick={addEntry}
              className="mt-3 rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-5 py-2 font-mono text-xs text-[#34d399] transition-colors hover:bg-[#34d399]/[0.14]"
            >
              追加
            </button>
          </div>

          {/* エントリー一覧 */}
          {entries.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.13] bg-white/[0.11]">
                  <tr>
                    {["日付", "種別", "投入額", "買値", "現在値", "損益率", ""].map((h) => (
                      <th key={h} className={`px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-slate-400 ${h === "日付" || h === "種別" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.slice().reverse().map((e) => {
                    const currentVal = e.amount * (currentPrice / e.sp500Level);
                    const ret = (currentPrice / e.sp500Level) - 1;
                    return (
                      <tr key={e.id} className="border-t border-white/[0.09]">
                        <td className="px-3 py-2 font-mono text-xs text-slate-400">{e.date}</td>
                        <td className="px-3 py-2">
                          <span className={`font-mono text-[10px] font-semibold ${TYPE_COLOR[e.type]}`}>{TYPE_LABEL[e.type]}</span>
                          {e.label && <span className="ml-1.5 font-mono text-[10px] text-slate-500">{e.label}</span>}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">¥{fmt(e.amount)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">{fmt(e.sp500Level, 2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs text-[#e8f4ff]">¥{fmt(currentVal)}</td>
                        <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${ret >= 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>
                          {fmtPct(ret)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => removeEntry(e.id)}
                            className="font-mono text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
