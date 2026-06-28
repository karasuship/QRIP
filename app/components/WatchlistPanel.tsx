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
  return (price - low) / (high - low);
}

export default function WatchlistPanel() {
  const [status, setStatus] = useState<"loading" | "guest" | "empty" | "done">("loading");
  const [stocks, setStocks] = useState<StockRow[]>([]);

  useEffect(() => {
    const sb = getSupabaseBrowser();
    if (!sb) { setStatus("guest"); return; }

    sb.auth.getSession().then(async ({ data }) => {
      const token = data.session?.access_token;
      if (!token) { setStatus("guest"); return; }

      try {
        const res = await fetch("/api/watchlist/prices", {
          headers: { "x-sb-token": token },
        });
        if (!res.ok) { setStatus("guest"); return; }
        const json = await res.json();
        setStocks(json.stocks ?? []);
        setStatus(json.stocks?.length > 0 ? "done" : "empty");
      } catch {
        setStatus("guest");
      }
    });
  }, []);

  if (status === "loading") return null;

  if (status === "guest") {
    return (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">ウォッチリスト</p>
          <p className="mt-0.5 text-xs text-slate-500">ログインして銘柄を登録するとここに表示されます</p>
        </div>
        <Link
          href="/mypage"
          className="shrink-0 rounded-lg border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-3 py-1.5 font-mono text-[10px] text-[#38bdf8] hover:bg-[#38bdf8]/[0.10] transition-colors"
        >
          登録する →
        </Link>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
        <p className="font-mono text-[9px] text-slate-600">ウォッチリストに銘柄がありません</p>
        <Link
          href="/mypage"
          className="font-mono text-[10px] text-[#38bdf8] hover:opacity-80 transition-opacity"
        >
          銘柄を追加 →
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[9px] uppercase tracking-widest text-slate-600">ウォッチリスト</p>
        <Link href="/mypage" className="font-mono text-[9px] text-slate-600 hover:text-slate-400 transition-colors">
          管理 →
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {stocks.map((s) => {
          const pos = w52Pos(s.price, s.week52_low, s.week52_high);
          return (
            <Link
              key={s.code}
              href={`/screener/${s.code}`}
              className="group rounded-xl border border-white/[0.10] bg-white/[0.03] px-3 py-2.5 transition-all hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-mono text-xs font-bold text-[#e8f4ff]">{s.name || s.code}</p>
                  <p className="font-mono text-[9px] text-slate-600">{s.code} · {s.market ?? "—"}</p>
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

              {/* 52週バー */}
              {pos != null && (
                <div className="mt-2 relative h-1 rounded-full bg-white/[0.06]">
                  <div
                    className="absolute top-0 bottom-0 left-0 rounded-full bg-[#38bdf8]/40"
                    style={{ width: `${(pos * 100).toFixed(0)}%` }}
                  />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-2 w-0.5 rounded-full bg-[#38bdf8]"
                    style={{ left: `${(pos * 100).toFixed(0)}%` }}
                  />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
