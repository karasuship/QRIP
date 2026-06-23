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
    <header className="border-b border-[#1e1e32] bg-[#050508]/90 backdrop-blur-sm sticky top-0 z-50">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold tracking-widest text-[#10b981]">
            QRIP
          </span>
          <span className="hidden text-[10px] tracking-widest text-[#2e2e48] sm:block uppercase">
            市場観測システム
          </span>
        </Link>
        <nav className="flex gap-6">
          {LINKS.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`text-xs tracking-wide transition-colors ${
                  active
                    ? "text-[#e2e8f0] font-medium"
                    : "text-[#64748b] hover:text-[#94a3b8]"
                }`}
              >
                {active && (
                  <span className="mr-1.5 inline-block h-1 w-1 rounded-full bg-[#10b981] align-middle" />
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
