"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase";
import { GlobalTicker } from "@/app/components/GlobalTicker";

const MAIN_LINKS = [
  { href: "/signal",   label: "シグナル", desc: "今日の買い場判定" },
  { href: "/screener", label: "銘柄",     desc: "バリュー株スクリーナー" },
  { href: "/news",     label: "ニュース", desc: "市場の空気感" },
  { href: "/mypage",   label: "マイページ", desc: "ウォッチリスト・アラート" },
];

const MORE_LINKS = [
  { href: "/radar",      label: "レーダー", desc: "成長加速企業トップ10・入れ替え予測" },
  { href: "/simulate",   label: "試算",   desc: "30年資産シミュレーション" },
  { href: "/compare",    label: "比較",   desc: "期待値・リスク・総合スコアを時間軸別に比較" },
  { href: "/portfolio",  label: "実績",   desc: "ポートフォリオ記録" },
  { href: "/journal",    label: "日誌",   desc: "投資日誌・暴落時の記録" },
  { href: "/learn",      label: "根拠",   desc: "バックテスト結果" },
  { href: "/research",   label: "書庫",   desc: "Round 01〜43 検証アーカイブ" },
  { href: "/hypotheses", label: "仮説",   desc: "次の検証仮説を提案・投票" },
  { href: "/board",      label: "掲示板", desc: "銘柄・考察・議論" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [moreOpen, setMoreOpen] = useState(false);

  const isMoreActive = MORE_LINKS.some((l) => pathname.startsWith(l.href));

  const handleSignOut = async () => {
    const sb = getSupabaseBrowser();
    if (sb) await sb.auth.signOut();
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 bg-[#020c1b]/90 backdrop-blur-xl">
      <GlobalTicker />
      <div className="border-b border-white/[0.15]" />
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="flex items-center gap-3 group shrink-0">
          <span className="font-mono text-sm font-bold tracking-widest text-[#38bdf8] group-hover:text-sky-300 transition-colors">
            QRIP
          </span>
          <span className="hidden text-[10px] tracking-widest text-slate-500 sm:block uppercase">
            市場観測システム
          </span>
        </Link>

        <nav className="flex items-center gap-0.5">
          {MAIN_LINKS.map(({ href, label, desc }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={desc}
                className={`relative flex items-center rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-all ${
                  active
                    ? "bg-white/[0.14] text-[#e8f4ff]"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.14]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#38bdf8]" />
                )}
                {label}
              </Link>
            );
          })}

          {/* … その他メニュー */}
          <div className="relative">
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className={`relative flex items-center rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-all ${
                isMoreActive || moreOpen
                  ? "bg-white/[0.14] text-[#e8f4ff]"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.14]"
              }`}
            >
              {isMoreActive && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#38bdf8]" />
              )}
              ···
            </button>

            {moreOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-44 rounded-2xl border border-white/[0.22] bg-[#020c1b]/95 backdrop-blur-xl shadow-xl overflow-hidden">
                  {MORE_LINKS.map(({ href, label, desc }) => {
                    const active = pathname.startsWith(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        title={desc}
                        onClick={() => setMoreOpen(false)}
                        className={`flex items-center px-4 py-2.5 text-xs transition-colors ${
                          active
                            ? "bg-white/[0.14] text-[#e8f4ff]"
                            : "text-slate-400 hover:bg-white/[0.11] hover:text-slate-200"
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                  <div className="border-t border-white/[0.15] px-4 py-2.5">
                    <button
                      onClick={() => { setMoreOpen(false); handleSignOut(); }}
                      className="text-xs text-slate-500 hover:text-slate-400 transition-colors"
                    >
                      ログアウト
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
