"use client";

import { useState } from "react";
import behavior from "./data/behavior.json";

const DEPTHS = ["5〜10%", "10〜20%", "20〜35%", "35%以上"];
const SPEEDS: { key: string; label: string }[] = [
  { key: "fast", label: "急落（1ヶ月で-10%以上）" },
  { key: "gradual", label: "じわじわ" },
];

function pct(n: number | null) {
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n}%`;
}

export default function Home() {
  const [depth, setDepth] = useState("10〜20%");
  const [speed, setSpeed] = useState("fast");
  const cell = behavior.cells.find((c) => c.depth === depth && c.speed === speed);
  const hasData = cell && cell.horizons.some((h) => h.median !== null);

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-2xl px-5 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">
          いま、売るべきか？ — 過去はこうだった
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          相場が下げると、最初の判断を忘れて投げ売りしたくなる。でも「どこまで下がる」は誰にも当てられない。
          だからこのツールは予測しません。
          <span className="font-medium text-zinc-800 dark:text-zinc-200">
            「過去、同じような局面はどうなったか」という事実
          </span>
          だけを見せます。
        </p>

        <section className="mt-8">
          <p className="text-sm font-medium">いま、高値からどれくらい下げていますか？</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEPTHS.map((d) => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  depth === d
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className="mt-5 text-sm font-medium">どんな下がり方ですか？</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SPEEDS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSpeed(s.key)}
                className={`rounded-full border px-4 py-1.5 text-sm transition ${
                  speed === s.key
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
                    : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="text-xs text-zinc-500">
            このサイトのロジック（{behavior.source}）では、
            <span className="font-medium">高値から{depth}・{speed === "fast" ? "急落" : "じわじわ"}</span>
            の局面から——
          </p>
          {hasData ? (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                {cell!.horizons.map((h) => (
                  <div key={h.h} className="rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-zinc-500">{h.h}後</p>
                    <p className="mt-1 text-xl font-semibold">{pct(h.median)}</p>
                    <p className="text-xs text-zinc-500">中央値</p>
                    <p className="mt-2 text-sm">勝率 {h.win}%</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      最悪 {pct(h.worst)}
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                つまり——
                <span className="font-medium text-rose-700 dark:text-rose-400">
                  最悪、さらに{pct(cell!.horizons[0].worst)}まで落ちた
                </span>
                こともある。
                <span className="font-medium">
                  でも1年持てば中央値{pct(cell!.horizons[1].median)}（勝率{cell!.horizons[1].win}%）、
                  3年で{pct(cell!.horizons[2].median)}（勝率{cell!.horizons[2].win}%）
                </span>
                だった。
                <br />
                投げる前に、この「最悪」と「耐えた先」を直視するために。
              </p>
              <p className="mt-2 text-xs text-zinc-400">
                過去の該当局面数: 約{cell!.n}（延べ）。回復は数週〜2ヶ月かけて来た事例が多い。
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-zinc-500">
              この組み合わせは過去の該当事例が少なく、信頼できる分布を出せません。
            </p>
          )}
        </section>

        <section className="mt-8">
          <p className="text-sm font-medium">そもそも、大きな下落はどれくらい来る？</p>
          <p className="mt-1 text-xs text-zinc-500">
            「待っていれば安く買える」と思いがちですが、大きな下落は滅多に来ません。
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-center text-sm">
              <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="py-2 font-medium">下落幅</th>
                  {behavior.dropProb[0].within.map((w) => (
                    <th key={w.days} className="py-2 font-medium">{w.days}以内</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {behavior.dropProb.map((row) => (
                  <tr key={row.x} className="border-t border-zinc-200 dark:border-zinc-800">
                    <td className="py-2 font-medium">{row.x}下落</td>
                    {row.within.map((w) => (
                      <td key={w.days} className="py-2 text-zinc-600 dark:text-zinc-400">
                        {w.p}%
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <p className="mt-10 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-400 dark:border-zinc-800">
          {behavior.note} これは投資助言ではなく、過去データの分布提示です。
        </p>
      </main>
    </div>
  );
}
