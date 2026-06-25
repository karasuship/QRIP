"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/",            label: "ホーム",   desc: "過去の相場分布" },
  { href: "/signal",      label: "シグナル", desc: "今日の買い場判定" },
  { href: "/news",        label: "ニュース", desc: "市場の空気感" },
  { href: "/simulate",    label: "試算",     desc: "30年資産シミュレーション" },
  { href: "/portfolio",   label: "実績",     desc: "ポートフォリオ記録" },
  { href: "/journal",     label: "日誌",     desc: "投資日誌・暴落時の記録" },
  { href: "/learn",       label: "検証",     desc: "バックテスト結果" },
  { href: "/research",    label: "書庫",     desc: "Round 01〜43 検証アーカイブ" },
  { href: "/hypotheses",  label: "仮説",     desc: "次の検証仮説を提案・投票" },
  { href: "/board",       label: "掲示板",   desc: "銘柄・考察・議論" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#020c1b]/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3 group">
          <span className="font-mono text-sm font-bold tracking-widest text-[#38bdf8] group-hover:text-sky-300 transition-colors">
            QRIP
          </span>
          <span className="hidden text-[10px] tracking-widest text-slate-600 sm:block uppercase">
            市場観測システム
          </span>
        </Link>
        <nav className="flex items-center gap-1">
          {LINKS.map(({ href, label, desc }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                title={desc}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium tracking-wide transition-all ${
                  active
                    ? "bg-white/[0.08] text-[#e8f4ff]"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]"
                }`}
              >
                {active && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-4 rounded-full bg-[#38bdf8]" />
                )}
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
