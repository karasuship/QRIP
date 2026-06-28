"use client";
import { useState } from "react";

export default function CollapseSection({
  badge,
  title,
  children,
  defaultOpen = true,
  border = true,
}: {
  badge: string;
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  border?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={border ? "border-b border-white/[0.15]" : ""}>
      <div className="mx-auto max-w-4xl px-6">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between py-7 text-left"
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-500 mb-0.5">{badge}</p>
            <h2 className="text-lg font-semibold text-[#e8f4ff]">{title}</h2>
          </div>
          <span className={`font-mono text-slate-500 text-base transition-transform duration-200 shrink-0 ml-4 ${open ? "" : "-rotate-90"}`}>▾</span>
        </button>
        {open && <div className="pb-10">{children}</div>}
      </div>
    </div>
  );
}
