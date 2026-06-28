"use client";

import { useState, useRef, useEffect } from "react";

interface TermProps {
  children: React.ReactNode;
  tip: string;
}

export function Term({ children, tip }: TermProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        className="border-b border-dotted border-slate-500 hover:border-[#38bdf8] hover:text-[#38bdf8] transition-colors cursor-help"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
      </button>
      {open && (
        <span className="absolute bottom-full left-0 mb-2 z-50 w-56 rounded-xl border border-white/[0.25] bg-[#020c1b]/95 px-3 py-2.5 text-[11px] leading-5 text-slate-300 shadow-2xl backdrop-blur-xl pointer-events-none">
          {tip}
          <span className="absolute -bottom-1.5 left-4 h-3 w-3 rotate-45 border-b border-r border-white/[0.18] bg-[#020c1b]/95" />
        </span>
      )}
    </span>
  );
}
