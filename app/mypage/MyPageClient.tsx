"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase";
import type { AlertConditions } from "@/app/api/screener-alerts/route";

// ── 型 ───────────────────────────────────────────────────────────
interface WatchItem {
  id: number;
  stock_code: string;
  stock_name: string | null;
  created_at: string;
}

interface StockPrice {
  code: string;
  price: number | null;
  week52_high: number | null;
  week52_low: number | null;
  dividend_yield: number | null;
}

interface AlertItem {
  id: number;
  name: string;
  conditions: AlertConditions;
  last_hit_codes: string[];
  last_checked: string | null;
  created_at: string;
}

type User = { id: string; email?: string } | null;

// ── ヘルパー ──────────────────────────────────────────────────────
function authHeader(token: string) {
  return { "x-sb-token": token, "Content-Type": "application/json" };
}

async function getToken(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

// ── メイン ────────────────────────────────────────────────────────
export default function MyPageClient() {
  const [user, setUser] = useState<User | "loading">("loading");
  const [tab, setTab] = useState<"watchlist" | "alerts">("watchlist");

  // watchlist state
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [stockPrices, setStockPrices] = useState<Map<string, StockPrice>>(new Map());
  const [wForm, setWForm] = useState({ code: "", name: "" });
  const [wLoading, setWLoading] = useState(false);
  const [wError, setWError] = useState("");

  // alerts state
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [aForm, setAForm] = useState<AlertConditions & { name: string }>({
    name: "条件1",
    pbr_max: undefined,
    per_max: undefined,
    dividend_yield_min: undefined,
    roe_min: undefined,
    equity_ratio_min: undefined,
    market: "",
  });
  const [aLoading, setALoading] = useState(false);
  const [aError, setAError] = useState("");

  // ── 認証確認 ─────────────────────────────────────────────────────
  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) { setUser(null); return; }
    sb.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── データ取得 ───────────────────────────────────────────────────
  const loadWatchlist = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const [wlRes, priceRes] = await Promise.all([
      fetch("/api/watchlist", { headers: authHeader(token) }),
      fetch("/api/watchlist/prices", { headers: authHeader(token) }),
    ]);
    if (wlRes.ok) {
      const json = await wlRes.json();
      setWatchlist(json.watchlist ?? []);
    }
    if (priceRes.ok) {
      const json = await priceRes.json();
      setStockPrices(new Map((json.stocks ?? []).map((s: StockPrice) => [s.code, s])));
    }
  }, []);

  const loadAlerts = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch("/api/screener-alerts", { headers: authHeader(token) });
    if (res.ok) {
      const json = await res.json();
      setAlerts(json.alerts ?? []);
    }
  }, []);

  useEffect(() => {
    if (user && user !== "loading") {
      loadWatchlist();
      loadAlerts();
    }
  }, [user, loadWatchlist, loadAlerts]);

  // ── ウォッチリスト操作 ────────────────────────────────────────────
  const addWatch = async () => {
    setWError("");
    const code = wForm.code.trim().replace(/\D/g, "");
    if (!code) { setWError("銘柄コードを入力してください"); return; }
    setWLoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("未ログイン");
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify({ stock_code: code, stock_name: wForm.name || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setWForm({ code: "", name: "" });
      await loadWatchlist();
    } catch (e) {
      setWError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setWLoading(false);
    }
  };

  const removeWatch = async (stock_code: string) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/watchlist?code=${stock_code}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    await loadWatchlist();
  };

  // ── アラート操作 ─────────────────────────────────────────────────
  const addAlert = async () => {
    setAError("");
    const { name, ...conds } = aForm;
    const hasCond = Object.values(conds).some((v) => v !== undefined && v !== "" && v !== null);
    if (!hasCond) { setAError("条件を1つ以上入力してください"); return; }

    setALoading(true);
    try {
      const token = await getToken();
      if (!token) throw new Error("未ログイン");
      const cleanConds: AlertConditions = {};
      if (conds.pbr_max)             cleanConds.pbr_max = Number(conds.pbr_max);
      if (conds.per_max)             cleanConds.per_max = Number(conds.per_max);
      if (conds.dividend_yield_min)  cleanConds.dividend_yield_min = Number(conds.dividend_yield_min) / 100;
      if (conds.roe_min)             cleanConds.roe_min = Number(conds.roe_min) / 100;
      if (conds.equity_ratio_min)    cleanConds.equity_ratio_min = Number(conds.equity_ratio_min) / 100;
      if (conds.market)              cleanConds.market = conds.market;

      const res = await fetch("/api/screener-alerts", {
        method: "POST",
        headers: authHeader(token),
        body: JSON.stringify({ name, conditions: cleanConds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      setAForm({ name: "条件1", pbr_max: undefined, per_max: undefined, dividend_yield_min: undefined, roe_min: undefined, equity_ratio_min: undefined, market: "" });
      await loadAlerts();
    } catch (e) {
      setAError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setALoading(false);
    }
  };

  const removeAlert = async (id: number) => {
    const token = await getToken();
    if (!token) return;
    await fetch(`/api/screener-alerts?id=${id}`, {
      method: "DELETE",
      headers: authHeader(token),
    });
    await loadAlerts();
  };

  const signIn = async () => {
    const sb = getSupabaseBrowser();
    if (!sb) return;
    await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback?next=/mypage` },
    });
  };

  // ── ローディング ─────────────────────────────────────────────────
  if (user === "loading") {
    return <div className="mt-12 font-mono text-xs text-slate-500 animate-pulse">● 読み込み中...</div>;
  }

  // ── 未ログイン ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="mt-6 space-y-6">
        {/* 機能プレビュー：ウォッチリスト */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.22] bg-white/[0.14]">
          <div className="px-5 pt-4 pb-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">ウォッチリスト</p>
            <div className="space-y-2 pointer-events-none select-none blur-[2px] opacity-50">
              {[
                { code: "9432", name: "NTT",  div: "3.4%", pbr: "1.2x" },
                { code: "2914", name: "JT",   div: "5.1%", pbr: "1.8x" },
                { code: "9433", name: "KDDI", div: "3.0%", pbr: "2.1x" },
              ].map((s) => (
                <div key={s.code} className="flex items-center gap-4 rounded-xl border border-white/[0.15] bg-white/[0.11] px-4 py-2.5">
                  <span className="font-mono text-sm font-bold text-[#e8f4ff] w-16">{s.name}</span>
                  <span className="font-mono text-[10px] text-slate-500">{s.code}</span>
                  <span className="font-mono text-[10px] text-[#34d399] ml-auto">配当 {s.div}</span>
                  <span className="font-mono text-[10px] text-slate-400">PBR {s.pbr}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-[#020c1b]/40 backdrop-blur-[1px]">
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8f4ff] mb-0.5">監視したい銘柄を登録</p>
              <p className="font-mono text-[10px] text-slate-400">価格・配当・PBRをまとめて追跡</p>
            </div>
          </div>
        </div>

        {/* 機能プレビュー：スクリーナーアラート */}
        <div className="relative overflow-hidden rounded-2xl border border-white/[0.22] bg-white/[0.14]">
          <div className="px-5 pt-4 pb-2">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">スクリーナーアラート</p>
            <div className="space-y-2 pointer-events-none select-none blur-[2px] opacity-50">
              {[
                { name: "高配当バリュー", tags: ["PBR≤1.0", "配当≥3.5%", "プライム"] },
                { name: "優良小型株",     tags: ["PBR≤0.8", "ROE≥15%", "自己資本≥50%"] },
              ].map((a) => (
                <div key={a.name} className="rounded-xl border border-white/[0.15] bg-white/[0.11] px-4 py-2.5">
                  <p className="font-mono text-xs font-semibold text-[#e8f4ff] mb-1.5">{a.name}</p>
                  <div className="flex gap-1.5">
                    {a.tags.map((t) => (
                      <span key={t} className="rounded-lg border border-[#38bdf8]/20 bg-[#38bdf8]/[0.06] px-2 py-0.5 font-mono text-[9px] text-[#38bdf8]">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-[#020c1b]/40 backdrop-blur-[1px]">
            <div className="text-center">
              <p className="text-sm font-medium text-[#e8f4ff] mb-0.5">条件を保存して毎夜通知</p>
              <p className="font-mono text-[10px] text-slate-400">「PBR1倍以下・配当3.5%以上」が出たら知らせる</p>
            </div>
          </div>
        </div>

        {/* ログイン CTA */}
        <div className="rounded-2xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.04] px-6 py-5 text-center">
          <p className="text-base font-semibold text-[#e8f4ff] mb-1">Google アカウントで 1 タップ</p>
          <p className="font-mono text-[10px] text-slate-400 mb-4">メール・電話番号の入力は不要</p>
          <button
            onClick={signIn}
            className="inline-flex items-center gap-2 rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.10] px-6 py-2.5 font-mono text-sm text-[#38bdf8] hover:bg-[#38bdf8]/[0.18] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
              <path d="M44.5 20H24v8.5h11.8C34.7 33.9 29.9 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c10.5 0 20-7.8 20-21 0-1.4-.1-2.7-.5-4z" fill="#38bdf8" opacity=".8"/>
            </svg>
            Google でログインして使う
          </button>
        </div>
      </div>
    );
  }

  // ── ログイン済み ─────────────────────────────────────────────────
  return (
    <div className="mt-6 space-y-4">
      {/* ユーザー情報 */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.18] bg-white/[0.14] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#34d399]" />
          <span className="font-mono text-xs text-slate-400">{user.email ?? "ログイン済み"}</span>
        </div>
        <button
          onClick={async () => { const sb = getSupabaseBrowser(); await sb?.auth.signOut(); setUser(null); }}
          className="font-mono text-[10px] text-slate-500 hover:text-slate-400 transition-colors"
        >
          ログアウト
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 rounded-xl border border-white/[0.18] bg-white/[0.14] p-1 w-fit">
        {(["watchlist", "alerts"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-1.5 font-mono text-xs transition-colors ${
              tab === t ? "bg-white/[0.10] text-[#e8f4ff]" : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t === "watchlist" ? `ウォッチリスト（${watchlist.length}）` : `スクリーナーアラート（${alerts.length}）`}
          </button>
        ))}
      </div>

      {/* ウォッチリスト */}
      {tab === "watchlist" && (
        <div className="space-y-3">
          {/* 追加フォーム */}
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.13] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">銘柄を追加</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={wForm.code}
                onChange={(e) => setWForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="銘柄コード（例: 9432）"
                className="w-36 rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
              />
              <input
                type="text"
                value={wForm.name}
                onChange={(e) => setWForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="名前（任意）"
                className="flex-1 min-w-32 rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
              />
              <button
                onClick={addWatch}
                disabled={wLoading}
                className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-4 py-2 font-mono text-xs text-[#34d399] transition-colors hover:bg-[#34d399]/[0.14] disabled:opacity-50"
              >
                {wLoading ? "追加中…" : "追加"}
              </button>
            </div>
            {wError && <p className="mt-2 font-mono text-xs text-red-400">{wError}</p>}
          </div>

          {/* 一覧 */}
          {watchlist.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] px-5 py-8 text-center">
              <p className="font-mono text-xs text-slate-500">まだ銘柄が登録されていません。</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.22]">
              {watchlist.map((w, i) => {
                const sp = stockPrices.get(w.stock_code);
                const pos = (sp?.price != null && sp.week52_high != null && sp.week52_low != null && sp.week52_high > sp.week52_low)
                  ? Math.max(0, Math.min(100, Math.round(((sp.price - sp.week52_low) / (sp.week52_high - sp.week52_low)) * 100)))
                  : null;
                return (
                  <div
                    key={w.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i !== watchlist.length - 1 ? "border-b border-white/[0.15]" : ""}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/screener/${w.stock_code}`}
                          className="font-mono text-sm font-bold text-[#e8f4ff] hover:text-[#38bdf8] transition-colors"
                        >
                          {w.stock_code}
                        </Link>
                        {w.stock_name && (
                          <span className="truncate text-xs text-slate-400">{w.stock_name}</span>
                        )}
                      </div>
                      {pos !== null && (
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="w-20 h-1 rounded-full bg-white/[0.11] overflow-hidden">
                            <div style={{ width: `${pos}%` }} className="h-full rounded-full bg-[#38bdf8]" />
                          </div>
                          <span className="font-mono text-[9px] text-slate-500">52週 {pos}%</span>
                        </div>
                      )}
                    </div>
                    {sp?.price != null && (
                      <div className="text-right">
                        <p className="font-mono text-xs text-slate-300">¥{sp.price.toLocaleString("ja-JP")}</p>
                        {sp.dividend_yield != null && (
                          <p className="font-mono text-[9px] text-slate-500">利回り {(sp.dividend_yield * 100).toFixed(1)}%</p>
                        )}
                      </div>
                    )}
                    <Link
                      href={`/screener/${w.stock_code}`}
                      className="font-mono text-[10px] text-slate-500 hover:text-[#38bdf8] transition-colors"
                    >
                      詳細 →
                    </Link>
                    <button
                      onClick={() => removeWatch(w.stock_code)}
                      className="font-mono text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                    >
                      削除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* スクリーナーアラート */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {/* アラート説明 */}
          <div className="rounded-xl border border-[#38bdf8]/15 bg-[#38bdf8]/[0.04] px-4 py-3">
            <p className="text-xs leading-5 text-slate-400">
              条件を設定すると、毎夜のスクリーナー更新時にヒットした銘柄を <strong className="text-[#38bdf8]">Web Push 通知</strong> でお知らせします。
              例：「PBR 1倍以下かつ配当利回り 3.5% 以上の銘柄が新たに現れたら通知」
            </p>
          </div>

          {/* 追加フォーム */}
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.13] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">条件を追加</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 mb-3">
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">PBR 以下</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={aForm.pbr_max ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, pbr_max: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="例: 1.0"
                  className="w-full rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">PER 以下</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={aForm.per_max ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, per_max: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="例: 15"
                  className="w-full rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">配当利回り % 以上</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={aForm.dividend_yield_min ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, dividend_yield_min: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="例: 3.5"
                  className="w-full rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">ROE % 以上</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={aForm.roe_min ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, roe_min: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="例: 10"
                  className="w-full rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">自己資本比率 % 以上</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={aForm.equity_ratio_min ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, equity_ratio_min: e.target.value ? Number(e.target.value) : undefined }))}
                  placeholder="例: 40"
                  className="w-full rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">市場</label>
                <select
                  value={aForm.market ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, market: e.target.value || undefined }))}
                  className="w-full rounded-xl border border-white/[0.22] bg-[#020c1b] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25"
                >
                  <option value="">すべて</option>
                  <option value="プライム">プライム</option>
                  <option value="スタンダード">スタンダード</option>
                  <option value="グロース">グロース</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <label className="font-mono text-[9px] text-slate-500">条件名</label>
              <input
                type="text"
                value={aForm.name}
                onChange={(e) => setAForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="例: 高配当バリュー"
                className="flex-1 rounded-xl border border-white/[0.22] bg-white/[0.14] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25"
              />
            </div>
            {aError && <p className="mb-2 font-mono text-xs text-red-400">{aError}</p>}
            <button
              onClick={addAlert}
              disabled={aLoading}
              className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-4 py-2 font-mono text-xs text-[#34d399] transition-colors hover:bg-[#34d399]/[0.14] disabled:opacity-50"
            >
              {aLoading ? "保存中…" : "保存"}
            </button>
          </div>

          {/* 一覧 */}
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11] px-5 py-8 text-center">
              <p className="font-mono text-xs text-slate-500">条件が登録されていません。</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => {
                const c = a.conditions;
                const tags: string[] = [];
                if (c.pbr_max)             tags.push(`PBR≤${c.pbr_max}`);
                if (c.per_max)             tags.push(`PER≤${c.per_max}`);
                if (c.dividend_yield_min)  tags.push(`配当≥${(c.dividend_yield_min * 100).toFixed(1)}%`);
                if (c.roe_min)             tags.push(`ROE≥${(c.roe_min * 100).toFixed(0)}%`);
                if (c.equity_ratio_min)    tags.push(`自己資本≥${(c.equity_ratio_min * 100).toFixed(0)}%`);
                if (c.market)              tags.push(c.market);
                return (
                  <div key={a.id} className="rounded-xl border border-white/[0.22] bg-white/[0.14] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-xs font-semibold text-[#e8f4ff] mb-1.5">{a.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t) => (
                            <span key={t} className="rounded-lg border border-[#38bdf8]/20 bg-[#38bdf8]/[0.06] px-2 py-0.5 font-mono text-[9px] text-[#38bdf8]">
                              {t}
                            </span>
                          ))}
                        </div>
                        {a.last_hit_codes && a.last_hit_codes.length > 0 && (
                          <p className="mt-1.5 font-mono text-[9px] text-slate-500">
                            前回ヒット: {a.last_hit_codes.slice(0, 5).join(", ")}
                            {a.last_hit_codes.length > 5 && ` 他${a.last_hit_codes.length - 5}件`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => removeAlert(a.id)}
                        className="shrink-0 font-mono text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
