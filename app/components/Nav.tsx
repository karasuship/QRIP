"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "診断" },
  { href: "/signal", label: "シグナル" },
  { href: "/news", label: "ニュース" },
  { href: "/learn", label: "検証" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#020c1b]/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3.5">
        <Link href="/" className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold tracking-widest text-[#38bdf8]">
            QRIP
          </span>
          <span className="hidden text-[10px] tracking-widest text-slate-500 sm:block uppercase">
            市場観測システム
          </span>
        </Link>
        <nav className="flex gap-7">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 text-xs tracking-wide transition-colors ${
                  active ? "text-[#e8f4ff] font-medium" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {active && (
                  <span className="h-1 w-1 rounded-full bg-[#38bdf8]" />
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
