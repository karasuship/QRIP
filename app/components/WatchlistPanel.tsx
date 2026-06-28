"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getSupabaseBrowser } from "@/lib/supabase";

interface StockRow {
  code: string;
  name: string;
  price: number | null;
  dividend_yield: number | null;
  week52_high: number | null;
  week52_low: number | null;
  pbr: number | null;
  market: string | null;
}

function w52Pos(price: number | null, low: number | null, high: number | null): number | null {
  if (price == null || low == null || high == null || high === low) return null;
  return Math.max(0, Math.min(1, (price - low) / (high - low)));
}

function StockCard({ s }: { s: StockRow }) {
  const pos = w52Pos(s.price, s.week52_low, s.week52_high);
  return (
    <Link
      href={`/screener/${s.code}`}
      className="group rounded-xl border border-white/[0.18] bg-white/[0.11] px-3 py-2.5 transition-all hover:bg-white/[0.11]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="font-mono text-xs font-bold text-[#e8f4ff]">{s.name || s.code}</p>
          <p className="font-mono text-[9px] text-slate-500">{s.code} · {s.market ?? "—"}</p>
        </div>
        <p className="font-mono text-sm font-bold text-[#e8f4ff] tabular-nums shrink-0">
          {s.price != null ? `¥${s.price.toLocaleString("ja-JP")}` : "—"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {s.dividend_yield != null && (
          <span className="font-mono text-[9px] text-slate-500">
            配当 <span className="text-[#34d399]">{(s.dividend_yield * 100).toFixed(1)}%</span>
          </span>
        )}
        {s.pbr != null && (
          <span className="font-mono text-[9px] text-slate-500">
            PBR <span className={s.pbr < 1 ? "text-[#34d399]" : "text-slate-400"}>{s.pbr.toFixed(1)}x</span>
          </span>
        )}
      </div>
      {pos != null && (
        <div className="mt-2 relative h-1 rounded-full bg-white/[0.11]">
          <div className="absolute top-0 bottom-0 left-0 rounded-full bg-[#38bdf8]/40" style={{ width: `${(pos * 100).toFixed(0)}%` }} />
          <div className="absolute top-1/2 -translate-y-1/2 h-2 w-0.5 rounded-full bg-[#38bdf8]" style={{ left: `${(pos * 100).toFixed(0)}%` }} />
        </div>
      )}
    </Link>
  );
}

export default function WatchlistPanel() {
  const [mode, setMode] = useState<"loading" | "demo" | "empty" | "live">("loading");
  const [stocks, setStocks] = useState<StockRow[]>([]);

  useEffect(() => {
    const sb = getSupabaseBrowser();

    async function init() {
      if (!sb) { await loadDemo(); return; }
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) { await loadDemo(); return; }

      try {
        const res = await fetch("/api/watchlist/prices", { headers: { "x-sb-token": token } });
        if (!res.ok) { await loadDemo(); return; }
        const json = await res.json();
        if (json.stocks?.length > 0) {
          setStocks(json.stocks);
          setMode("live");
        } else {
          setMode("empty");
        }
      } catch {
        await loadDemo();
      }
    }

    async function loadDemo() {
      try {
        const res = await fetch("/api/watchlist/demo");
        const json = await res.json();
        setStocks(json.stocks ?? []);
      } catch { /* silent */ }
      setMode("demo");
    }

    init();
  }, []);

  if (mode === "loading") return null;

  // ── ウォッチリスト空（ログイン済みで未登録） ──
  if (mode === "empty") {
    return (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.15] bg-white/[0.02] px-4 py-3">
        <p className="font-mono text-[9px] text-slate-500">ウォッチリストに銘柄がありません</p>
        <Link href="/mypage" className="font-mono text-[10px] text-[#38bdf8] hover:opacity-80 transition-opacity">
          銘柄を追加 →
        </Link>
      </div>
    );
  }

  // ── ライブ（ログイン済み・銘柄あり） ──
  if (mode === "live") {
    return (
      <div className="mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">ウォッチリスト</p>
          <Link href="/mypage" className="font-mono text-[9px] text-slate-500 hover:text-slate-400 transition-colors">管理 →</Link>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {stocks.map((s) => <StockCard key={s.code} s={s} />)}
        </div>
      </div>
    );
  }

  // ── デモ（未ログイン） ──
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500">ウォッチリスト</p>
          <span className="rounded-full border border-amber-400/30 bg-amber-400/[0.08] px-2 py-0.5 font-mono text-[8px] text-amber-400">
            サンプル
          </span>
        </div>
      </div>

      {/* カード群（ぼかし + オーバーレイ） */}
      <div className="relative">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 pointer-events-none select-none blur-[1.5px] opacity-60">
          {stocks.map((s) => <StockCard key={s.code} s={s} />)}
        </div>

        {/* CTA オーバーレイ */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-2xl border border-[#38bdf8]/25 bg-[#020c1b]/80 backdrop-blur-sm px-6 py-4 text-center">
            <p className="text-sm font-medium text-[#e8f4ff] mb-1">自分の銘柄を登録して追跡</p>
            <p className="font-mono text-[10px] text-slate-400 mb-3">
              配当利回り・PBR・52週バーをダッシュボードに表示
            </p>
            <Link
              href="/mypage"
              className="inline-block rounded-xl border border-[#38bdf8]/30 bg-[#38bdf8]/[0.10] px-4 py-2 font-mono text-xs text-[#38bdf8] hover:bg-[#38bdf8]/[0.18] transition-colors"
            >
              Google でログインして登録する →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
