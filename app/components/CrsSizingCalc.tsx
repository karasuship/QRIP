"use client";
import { useState } from "react";

interface Props {
  crs: number;
}

export default function CrsSizingCalc({ crs }: Props) {
  const [monthly, setMonthly] = useState(30000);

  const multiplier = crs >= 5 ? 2.0 : crs >= 4 ? 1.5 : crs >= 2 ? 1.0 : null;
  const label =
    crs >= 5 ? "2倍投入（R37 推奨）" :
    crs >= 4 ? "1.5倍を検討"        :
    crs >= 2 ? "通常（1倍）"        : null;
  const color =
    crs >= 5 ? "text-violet-300" :
    crs >= 4 ? "text-[#f87171]"  :
    crs >= 2 ? "text-amber-400"  : "text-slate-400";

  if (multiplier === null) return null;

  const recommended = Math.round(monthly * multiplier);

  return (
    <div className="mt-3 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
      <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">
        CRS連動サイジング試算
      </p>
      <div className="flex items-center gap-3">
        <label className="font-mono text-xs text-slate-400 whitespace-nowrap">月額DCA</label>
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-slate-400">¥</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={monthly}
            onChange={(e) => setMonthly(Math.max(1000, Number(e.target.value)))}
            className="w-full rounded-xl border border-white/[0.15] bg-white/[0.06] py-2 pl-7 pr-3 font-mono text-sm text-[#e8f4ff] outline-none focus:border-white/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border border-white/[0.09] bg-white/[0.04] px-4 py-3">
        <div>
          <p className="font-mono text-[10px] text-slate-500">CRS = {crs} / 推奨</p>
          <p className={`font-mono text-xs font-semibold mt-0.5 ${color}`}>{label}</p>
        </div>
        <div className="text-right">
          <p className={`font-mono text-2xl font-bold tabular-nums ${color}`}>
            ¥{recommended.toLocaleString("ja-JP")}
          </p>
          {multiplier > 1 && (
            <p className="font-mono text-[10px] text-slate-500">
              通常比 +¥{(recommended - monthly).toLocaleString("ja-JP")}
            </p>
          )}
        </div>
      </div>

      <p className="mt-2 font-mono text-[9px] text-slate-600 leading-4">
        R37: CRS=5が最高品質（TEST Z=+4.48, DCA比+15.9%）。CRS連動サイジングはTRAIN Z最高値（+5.51）。
        推奨額は過去統計に基づく参考値。投資判断はご自身の責任で。
      </p>
    </div>
  );
}
