import Link from "next/link";
import { lessons, closing } from "../data/lessons";

export const metadata = {
  title: "QRIP — タイミングという幻想（検証で分かった事実）",
  description:
    "30年分の自前バックテストで分かったこと。買うタイミングはほぼ効かない。DCAを超える方法は3つだけで、すべて“暴落に耐える胆力”が前提だった。",
};

export default function Learn() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-2xl px-5 py-12">
        <Link
          href="/"
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← いま売るべきか診断にもどる
        </Link>

        <h1 className="mt-6 text-2xl font-semibold tracking-tight">
          タイミングという幻想
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          「もっと安く買えたはず」「今は待つべきだ」——その直感を、30年分のデータで全部検証しました。
          結論は、投資の常識をなぞるようでいて、行動を変えるものでした。
        </p>

        <div className="mt-10 space-y-12">
          {lessons.map((l) => (
            <section key={l.id}>
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                {l.tag}
              </p>
              <h2 className="mt-1 text-lg font-semibold">{l.title}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                {l.lead}
              </p>

              {l.rows && (
                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <tbody>
                      {l.rows.map((r) => (
                        <tr
                          key={r.label}
                          className="border-t border-zinc-200 first:border-t-0 dark:border-zinc-800"
                        >
                          <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">
                            {r.label}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                            {r.value}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-zinc-400">
                            {r.note ?? ""}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {l.body.map((p, i) => (
                <p
                  key={i}
                  className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-300"
                >
                  {p}
                </p>
              ))}

              <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium leading-6 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                {l.takeaway}
              </p>
            </section>
          ))}
        </div>

        <p className="mt-12 border-t border-zinc-200 pt-6 text-base font-medium leading-7 dark:border-zinc-800">
          {closing}
        </p>
        <Link
          href="/"
          className="mt-5 inline-block rounded-full border border-zinc-900 bg-zinc-900 px-5 py-2 text-sm text-white transition hover:opacity-90 dark:border-zinc-100 dark:bg-zinc-100 dark:text-black"
        >
          いま売るべきか、過去を見る →
        </Link>

        <p className="mt-8 text-xs leading-5 text-zinc-400">
          数値はS&P500等の過去データに対する自前バックテスト（engine/archive）由来。
          過去の分布であり、将来を保証しません。これは投資助言ではなく事実の提示です。
        </p>
      </main>
    </div>
  );
}
