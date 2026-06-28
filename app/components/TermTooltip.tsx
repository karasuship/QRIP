"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { TERMS } from "@/lib/term-definitions";

interface Props {
  term: string;                        // TERMS のキー
  children: React.ReactNode;           // クリック対象のテキスト
  className?: string;                  // 親からのスタイル上書き
}

export default function TermTooltip({ term, children, className }: Props) {
  const def = TERMS[term];
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // 外クリックで閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // ESC で閉じる
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  if (!def) return <>{children}</>;

  return (
    <span ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          className ??
          "border-b border-dotted border-current cursor-help transition-opacity hover:opacity-80"
        }
        aria-expanded={open}
        aria-label={`${def.label}の説明を表示`}
      >
        {children}
      </button>

      {open && (
        <span
          className={[
            "absolute z-50 left-0 top-full mt-2",
            "w-72 rounded-2xl border border-white/[0.15] bg-[#0d1117]/98 backdrop-blur-md",
            "p-4 shadow-2xl shadow-black/60",
            "text-left font-normal",
          ].join(" ")}
          role="tooltip"
        >
          {/* ヘッダー */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-slate-400">
              {def.label}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="font-mono text-[10px] text-slate-500 hover:text-slate-400 transition-colors shrink-0"
              aria-label="閉じる"
            >✕</button>
          </div>

          {/* 定義 */}
          <p className="text-xs leading-5 text-slate-300">{def.def}</p>

          {/* 補足 */}
          {def.detail && (
            <p className="mt-1.5 text-[10px] leading-4 text-slate-500">{def.detail}</p>
          )}

          {/* 統計 */}
          {def.stat && (
            <div className="mt-2.5 rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.07] px-2.5 py-1.5">
              <p className="font-mono text-[10px] text-[#34d399]">{def.stat}</p>
            </div>
          )}

          {/* リンク */}
          {def.link && (
            <Link
              href={def.link}
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-[#38bdf8] hover:underline"
            >
              {def.linkLabel ?? "詳しく"} →
            </Link>
          )}
        </span>
      )}
    </span>
  );
}
