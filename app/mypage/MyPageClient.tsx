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
    const res = await fetch("/api/watchlist", { headers: authHeader(token) });
    if (res.ok) {
      const json = await res.json();
      setWatchlist(json.watchlist ?? []);
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
    return <div className="mt-12 font-mono text-xs text-slate-600 animate-pulse">● 読み込み中...</div>;
  }

  // ── 未ログイン ───────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="mt-12 flex flex-col items-center gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.04] p-10 text-center">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">ログインが必要</p>
        <p className="text-sm text-slate-400 max-w-sm">
          ウォッチリストやスクリーナーアラートを利用するにはログインが必要です。
        </p>
        <button
          onClick={signIn}
          className="mt-2 flex items-center gap-2 rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.08] px-5 py-2.5 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/[0.16] transition-colors"
        >
          Google でログイン
        </button>
        <p className="font-mono text-[9px] text-slate-700">
          Google アカウントでワンタップ。メールや電話番号の入力は不要。
        </p>
      </div>
    );
  }

  // ── ログイン済み ─────────────────────────────────────────────────
  return (
    <div className="mt-6 space-y-4">
      {/* ユーザー情報 */}
      <div className="flex items-center justify-between rounded-xl border border-white/[0.10] bg-white/[0.04] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#34d399]" />
          <span className="font-mono text-xs text-slate-400">{user.email ?? "ログイン済み"}</span>
        </div>
        <button
          onClick={async () => { const sb = getSupabaseBrowser(); await sb?.auth.signOut(); setUser(null); }}
          className="font-mono text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          ログアウト
        </button>
      </div>

      {/* タブ */}
      <div className="flex gap-1 rounded-xl border border-white/[0.10] bg-white/[0.04] p-1 w-fit">
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
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.07] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">銘柄を追加</p>
            <div className="flex gap-2 flex-wrap">
              <input
                type="text"
                value={wForm.code}
                onChange={(e) => setWForm((f) => ({ ...f, code: e.target.value }))}
                placeholder="銘柄コード（例: 9432）"
                className="w-36 rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
              />
              <input
                type="text"
                value={wForm.name}
                onChange={(e) => setWForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="名前（任意）"
                className="flex-1 min-w-32 rounded-xl border border-white/[0.15] bg-white/[0.06] px-3 py-2 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30"
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
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-8 text-center">
              <p className="font-mono text-xs text-slate-600">まだ銘柄が登録されていません。</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.12]">
              {watchlist.map((w, i) => (
                <div
                  key={w.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i !== watchlist.length - 1 ? "border-b border-white/[0.08]" : ""}`}
                >
                  <div className="flex-1 flex items-center gap-3">
                    <Link
                      href={`/screener/${w.stock_code}`}
                      className="font-mono text-sm font-bold text-[#e8f4ff] hover:text-[#38bdf8] transition-colors"
                    >
                      {w.stock_code}
                    </Link>
                    {w.stock_name && (
                      <span className="text-xs text-slate-400">{w.stock_name}</span>
                    )}
                  </div>
                  <Link
                    href={`/screener/${w.stock_code}`}
                    className="font-mono text-[10px] text-slate-600 hover:text-[#38bdf8] transition-colors"
                  >
                    詳細 →
                  </Link>
                  <button
                    onClick={() => removeWatch(w.stock_code)}
                    className="font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors"
                  >
                    削除
                  </button>
                </div>
              ))}
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
          <div className="rounded-2xl border border-white/[0.15] bg-white/[0.07] p-4">
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
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="w-full rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
              <div>
                <label className="font-mono text-[9px] text-slate-500 block mb-1">市場</label>
                <select
                  value={aForm.market ?? ""}
                  onChange={(e) => setAForm((f) => ({ ...f, market: e.target.value || undefined }))}
                  className="w-full rounded-xl border border-white/[0.12] bg-[#020c1b] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25"
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
                className="flex-1 rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/25"
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
            <div className="rounded-2xl border border-white/[0.10] bg-white/[0.03] px-5 py-8 text-center">
              <p className="font-mono text-xs text-slate-600">条件が登録されていません。</p>
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
                  <div key={a.id} className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-4 py-3">
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
                        className="shrink-0 font-mono text-[10px] text-slate-700 hover:text-red-400 transition-colors"
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
