"use client";

import { useState } from "react";
import Link from "next/link";
import { TERMS } from "@/lib/term-definitions";

interface Props {
  /** このページで使われている用語キーの配列 */
  terms: string[];
  /** アンカーやページ名など、追加の「関連ページ」リンク */
  relatedPages?: { label: string; href: string; note: string }[];
}

export default function QuickRef({ terms, relatedPages }: Props) {
  const [open, setOpen] = useState(false);

  const defs = terms.map((k) => ({ key: k, ...TERMS[k] })).filter((d) => d.label);

  return (
    <div className="rounded-2xl border border-white/[0.18] bg-white/[0.11]">
      {/* トグルヘッダー */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] uppercase tracking-widest text-slate-500">
            このページの用語・根拠
          </span>
          <span className="rounded-full border border-white/[0.18] px-1.5 py-0 font-mono text-[9px] text-slate-500">
            {defs.length}語
          </span>
        </div>
        <span
          className={`font-mono text-[10px] text-slate-500 transition-transform ${open ? "rotate-90" : ""}`}
        >
          ▶
        </span>
      </button>

      {/* 展開コンテンツ */}
      {open && (
        <div className="border-t border-white/[0.15] px-4 pb-4 pt-3 space-y-3">
          {/* 用語グリッド */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {defs.map((d) => (
              <div
                key={d.key}
                className="rounded-xl border border-white/[0.15] bg-white/[0.11] px-3 py-2.5"
              >
                <p className="font-mono text-[10px] font-bold text-slate-300">{d.label}</p>
                <p className="mt-0.5 text-[10px] leading-4 text-slate-500">{d.def}</p>
                {d.stat && (
                  <p className="mt-1 font-mono text-[9px] text-[#34d399]">{d.stat}</p>
                )}
                {d.link && (
                  <Link
                    href={d.link}
                    className="mt-1 inline-block font-mono text-[9px] text-[#38bdf8] hover:underline"
                  >
                    {d.linkLabel ?? "詳しく"} →
                  </Link>
                )}
              </div>
            ))}
          </div>

          {/* 関連ページリンク */}
          {relatedPages && relatedPages.length > 0 && (
            <div className="border-t border-white/[0.15] pt-3">
              <p className="font-mono text-[9px] uppercase tracking-widest text-slate-500 mb-2">
                関連ページ
              </p>
              <div className="flex flex-wrap gap-2">
                {relatedPages.map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="rounded-xl border border-white/[0.18] bg-white/[0.11] px-3 py-1.5 hover:bg-white/[0.11] transition-colors"
                  >
                    <p className="font-mono text-[10px] text-slate-300">{p.label}</p>
                    <p className="font-mono text-[9px] text-slate-500">{p.note}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
