"use client";
import { useState } from "react";

export default function CollapseBlock({
  title,
  badge,
  children,
  defaultOpen = false,
  className = "",
}: {
  title: string;
  badge?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left py-0.5 group"
      >
        <div className="flex items-center gap-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">{title}</p>
          {badge && (
            <span className="rounded-full border border-white/[0.18] bg-white/[0.06] px-2 py-0.5 font-mono text-[9px] text-slate-500">
              {badge}
            </span>
          )}
        </div>
        <span className={`font-mono text-slate-500 text-xs transition-transform duration-150 shrink-0 ml-3 ${open ? "" : "-rotate-90"}`}>▾</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
