import { fetchSignal } from "@/lib/signal";
import type { Metadata } from "next";
import Link from "next/link";
import LiveMetrics from "@/app/components/LiveMetrics";
import PushSubscribe from "@/app/components/PushSubscribe";

export const metadata: Metadata = {
  title: "QRIP — 今日のシグナル",
  description:
    "phi2 v3 / RSI<25 / HYG-8% / B4 / EFA / EEM のリアルタイム発動状態（Yahoo Finance 15分更新）",
};

export const revalidate = 900;

function pct(n: number, sign = true): string {
  const s = (n * 100).toFixed(2) + "%";
  return sign && n >= 0 ? "+" + s : s;
}

function CRSDot({ active, label }: { active: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        active
          ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
          : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500"
      }`}
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${active ? "bg-red-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
      />
      {label}
    </span>
  );
}

function SignalBadge({
  active,
  label,
  sub,
  quality,
}: {
  active: boolean;
  label: string;
  sub: string;
  quality: "high" | "mid" | "low";
}) {
  const colors = {
    high: active
      ? "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
    mid: active
      ? "border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
    low: active
      ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950"
      : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
  };
  return (
    <div className={`rounded-xl border p-3 ${colors[quality]}`}>
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            active
              ? quality === "high"
                ? "bg-emerald-500"
                : quality === "mid"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        />
        <p className={`text-sm font-medium ${active ? "" : "text-zinc-400 dark:text-zinc-600"}`}>
          {label}
        </p>
        {active && (
          <span className="ml-auto text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            発動中
          </span>
        )}
      </div>
      <p className="mt-1 pl-4 text-xs text-zinc-500">{sub}</p>
    </div>
  );
}

export default async function SignalPage() {
  let signal;
  let error: string | null = null;

  try {
    signal = await fetchSignal();
  } catch (e) {
    error = String(e);
  }

  if (error || !signal) {
    return (
      <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
        <main className="mx-auto max-w-2xl px-5 py-12">
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            ← ホームにもどる
          </Link>
          <p className="mt-8 text-sm text-rose-600">
            データ取得に失敗しました。しばらくしてから再読み込みしてください。
          </p>
          {error && <p className="mt-2 text-xs text-zinc-400">{error}</p>}
        </main>
      </div>
    );
  }

  const {
    date, price, ath, athDd, ageAth, ageAthOk,
    vol20, dayRet, rsi14, vix,
    crs, crsComponents,
    phi2Active, rsi25Active, rsi25Crossunder,
    hygSignal, b4Active, b4BaseDate,
    efaAthDd, efaActive, eemAthDd, eemActive,
    signalTier, history, pastEpisodes,
  } = signal;

  type StatusConfig = {
    label: string;
    sub: string;
    detail: string;
    color: string;
  };

  const statusMap: Record<typeof signalTier, StatusConfig> = {
    DOUBLE: {
      label: "phi2 v3 + RSI<25 同時発動（超高品質）",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · RSI ${rsi14?.toFixed(1) ?? "—"}`,
      detail: "過去30年8回しかない最高品質シグナル。DCA 追加投入を強く検討。",
      color: "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950",
    },
    PHI2: {
      label: "phi2 v3 発動",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · vol ${vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}`,
      detail: "年平均3回。63日後平均+13.6%（DCA比）。追加投入日。",
      color: "border-emerald-300 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950",
    },
    RSI25: {
      label: "RSI<25 シグナル（低信頼度）",
      sub: `RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} · phi2 条件は未達`,
      detail: "短期反発の統計的根拠は薄い。長期保有前提の追加投入なら合理的。",
      color: "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950",
    },
    NEAR: {
      label: "発動圏内 — 条件待ち",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6`,
      detail: (() => {
        const missing: string[] = [];
        if (dayRet === null || dayRet > -0.02)
          missing.push(`当日 −2%（現在 ${dayRet !== null ? pct(dayRet) : "—"}）`);
        if (vol20 === null || vol20 <= 0.25)
          missing.push(`vol20 > 25%（現在 ${vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}）`);
        if (!ageAthOk)
          missing.push(`age_ath 除外ゾーン（${ageAth}日 ∈ [91-252]）`);
        if (crs < 2) missing.push(`CRS ≥ 2（現在 ${crs}）`);
        return `未達条件: ${missing.join(" / ")}`;
      })(),
      color: "border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950",
    },
    NONE: {
      label: "待機中 — 発動圏外",
      sub: `ATH ${pct(athDd)} — phi2 圏（−10%）に達していない`,
      detail: "通常の市場状態。定期積立（DCA）を継続。",
      color: "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900",
    },
  };

  const st = statusMap[signalTier];
  const isActive = signalTier === "PHI2" || signalTier === "DOUBLE";

  const conclusion = (() => {
    if (signalTier === "DOUBLE") return {
      text: "🔴 最高品質シグナル同時発動。30年で8回のみの局面。積極的な追加投入を検討してください。",
      cls: "border-violet-500/30 bg-violet-500/10 text-[#c4b5fd]",
    };
    if (signalTier === "PHI2") return {
      text: "⚡ 買い増しシグナル発動中。過去の同条件、63日後の平均はDCA比 +13.6%。",
      cls: "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]",
    };
    if (hygSignal) return {
      text: "⚡ HYG-8% シグナル発動中。クレジット市場の恐怖を検知。30年統計 TEST Z=+9.42。",
      cls: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    };
    if (b4Active) return {
      text: "⚡ B4 追加タイミング。phi2 発動から7営業日、ATH-10% 圏内が継続しています。",
      cls: "border-blue-500/30 bg-blue-500/10 text-blue-400",
    };
    if (signalTier === "RSI25") return {
      text: "RSI<25 シグナル。短期反発の根拠は薄いが、長期保有前提の追加投入なら合理的。",
      cls: "border-amber-500/20 bg-amber-500/5 text-amber-400/80",
    };
    if (signalTier === "NEAR") return {
      text: "発動圏内に入っています。条件はまだ揃っていません。引き続き定期積立を続けてください。",
      cls: "border-[#1e1e32] bg-[#0c0c15] text-[#94a3b8]",
    };
    return {
      text: "今日は通常状態です。定期積立（DCA）を続けてください。",
      cls: "border-[#1e1e32] bg-[#090910] text-[#64748b]",
    };
  })();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto max-w-2xl px-5 py-12">
        <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
          ← ホームにもどる
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              今日のシグナル状態
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              最終取引日: {date} · 15分キャッシュ（Yahoo Finance ^GSPC）
            </p>
          </div>
          <PushSubscribe />
        </div>

        {/* 今日の結論 */}
        <div className={`mt-5 rounded-xl border px-5 py-4 ${conclusion.cls}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-50 mb-1.5">
            今日の結論
          </p>
          <p className="text-base font-semibold leading-snug">
            {conclusion.text}
          </p>
        </div>

        {/* メインステータス */}
        <div className={`mt-4 rounded-2xl border p-5 ${st.color}`}>
          <p className="text-xl font-semibold">{st.label}</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{st.sub}</p>
          <p className={`mt-3 text-sm font-medium ${isActive ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
            {st.detail}
          </p>
        </div>

        {/* ── 全シグナル一覧 ───────────────────────────── */}
        <section className="mt-5">
          <p className="mb-2 text-sm font-medium">全シグナル状態（4体制 v3）</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SignalBadge
              active={phi2Active}
              label="phi2 v3（主力）"
              sub={`ATH-10% · 当日-2% · vol>25% · CRS≥2 · age非L字 | TEST Z=+8.65`}
              quality="high"
            />
            <SignalBadge
              active={rsi25Crossunder}
              label="RSI<25 クロスアンダー"
              sub={`RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} | TEST Z=+3.92`}
              quality="mid"
            />
            <SignalBadge
              active={hygSignal}
              label="HYG-8% QE後"
              sub={`HYG 60日高値-8%以下 AND ATH-5%以下 | TEST Z=+9.42`}
              quality="high"
            />
            <SignalBadge
              active={b4Active}
              label={`B4（phi2後7日）${b4BaseDate ? `← ${b4BaseDate}` : ""}`}
              sub={`phi2発動7営業日後 AND 今日もATH-10%以下 | TEST Z=+8.29`}
              quality="mid"
            />
            <SignalBadge
              active={efaActive}
              label="EFA 先進国（除く米国）"
              sub={`ATH乖離 ${efaAthDd !== null ? pct(efaAthDd) : "—"} · SP500 CRS共用 | TEST Z=+8.08`}
              quality="low"
            />
            <SignalBadge
              active={eemActive}
              label="EEM 新興国"
              sub={`ATH乖離 ${eemAthDd !== null ? pct(eemAthDd) : "—"} · SP500 CRS共用`}
              quality="low"
            />
          </div>
        </section>

        {/* CRS スコア */}
        <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              CRS スコア（Crisis Recovery Score）
            </p>
            <span
              className={`rounded-full px-3 py-1 text-sm font-bold ${
                crs >= 4
                  ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                  : crs >= 2
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
              }`}
            >
              {crs} / 6
            </span>
          </div>
          <p className="mt-1 mb-3 text-xs text-zinc-400">
            ≥ 2 でシグナル有効 · ≥ 4 で高品質 · 5-6 で 2x 投入検討
          </p>
          <div className="flex flex-wrap gap-1.5">
            <CRSDot active={crsComponents.c1} label="VIX>30" />
            <CRSDot active={crsComponents.c2} label="HYG3日落" />
            <CRSDot active={crsComponents.c3} label="DXY5日高" />
            <CRSDot active={crsComponents.c4} label="ATH90日内" />
            <CRSDot active={crsComponents.c5} label="HYG60日-8%" />
            <CRSDot active={crsComponents.c6} label="RSP弱" />
          </div>
        </section>

        {/* メトリクス（60秒ライブ更新） */}
        <div className="mt-4">
          <LiveMetrics initial={signal} />
        </div>

        {/* phi2 v3 条件チェックリスト */}
        <section className="mt-5 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <p className="mb-3 text-sm font-medium">phi2 v3 発動条件</p>
          {(
            [
              { label: "ATH 乖離 ≤ −10%", ok: athDd <= -0.1, val: pct(athDd) },
              { label: "当日リターン ≤ −2%", ok: dayRet !== null && dayRet <= -0.02, val: dayRet !== null ? pct(dayRet) : "—" },
              { label: "vol20 > 25%", ok: vol20 !== null && vol20 > 0.25, val: vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—" },
              { label: "age_ath ∉ [91-252]", ok: ageAthOk, val: `${ageAth}日` },
              { label: "CRS ≥ 2", ok: crs >= 2, val: `${crs}/6` },
            ] as { label: string; ok: boolean; val: string }[]
          ).map(({ label, ok, val }) => (
            <div
              key={label}
              className="flex items-center justify-between border-b border-zinc-100 py-1.5 last:border-0 dark:border-zinc-800"
            >
              <span className="flex items-center gap-2 text-sm">
                <span className={ok ? "text-emerald-500" : "text-zinc-300 dark:text-zinc-600"}>
                  {ok ? "✓" : "○"}
                </span>
                {label}
              </span>
              <span className={`text-sm font-mono ${ok ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                {val}
              </span>
            </div>
          ))}
        </section>

        {/* 過去類似事例 */}
        {pastEpisodes.length > 0 && (
          <section className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
            <p className="text-sm font-medium">過去2年の phi2 類似事例</p>
            <p className="mt-0.5 text-xs text-zinc-400">
              ATH−10% · 当日−2% · vol&gt;25% · age非L字を満たした日 — その後のリターン（実績）
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">日付</th>
                    <th className="px-3 py-2 text-right font-medium">当日</th>
                    <th className="px-3 py-2 text-right font-medium">ATH 乖離</th>
                    <th className="px-3 py-2 text-right font-medium">今日まで</th>
                    <th className="px-3 py-2 text-right font-medium">経過</th>
                  </tr>
                </thead>
                <tbody>
                  {pastEpisodes.slice(0, 10).map((ep) => (
                    <tr key={ep.date} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs">{ep.date}</td>
                      <td className="px-3 py-2 text-right text-rose-600 dark:text-rose-400">
                        {pct(ep.dayRet)}
                      </td>
                      <td className="px-3 py-2 text-right text-zinc-500">
                        {pct(ep.athDd)}
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold ${
                        ep.retToDate > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}>
                        {pct(ep.retToDate)}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-zinc-400">
                        {ep.daysAgo < 30
                          ? `${ep.daysAgo}日前`
                          : `${Math.round(ep.daysAgo / 21)}ヶ月前`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pastEpisodes.length > 0 && (
              <p className="mt-2 text-xs text-zinc-400">
                平均リターン:{" "}
                <span className={`font-semibold ${
                  pastEpisodes.slice(0, 10).reduce((a, e) => a + e.retToDate, 0) / Math.min(pastEpisodes.length, 10) > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600"
                }`}>
                  {pct(
                    pastEpisodes.slice(0, 10).reduce((a, e) => a + e.retToDate, 0) /
                      Math.min(pastEpisodes.length, 10)
                  )}
                </span>
                {" · "}勝率:{" "}
                <span className="font-semibold">
                  {Math.round(
                    (pastEpisodes.slice(0, 10).filter((e) => e.retToDate > 0).length /
                      Math.min(pastEpisodes.length, 10)) * 100
                  )}%
                </span>
              </p>
            )}
          </section>
        )}

        {/* 直近30日 phi2 候補日 */}
        <section className="mt-8 border-t border-zinc-200 pt-6 dark:border-zinc-800">
          <p className="text-sm font-medium">過去 30 日の phi2 v3 候補日</p>
          <p className="mt-0.5 text-xs text-zinc-400">
            ATH −10% · 当日 −2% · vol &gt; 25% を満たした日
          </p>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-zinc-500">
              過去 30 日以内に phi2 候補日なし
            </p>
          ) : (
            <div className="mt-3 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-sm">
                <thead className="bg-zinc-100 text-xs text-zinc-500 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">日付</th>
                    <th className="px-3 py-2 text-right font-medium">当日</th>
                    <th className="px-3 py-2 text-right font-medium">ATH 乖離</th>
                    <th className="px-3 py-2 text-right font-medium">CRS</th>
                    <th className="px-3 py-2 text-right font-medium">phi2 v3</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date} className="border-t border-zinc-200 dark:border-zinc-800">
                      <td className="px-3 py-2 font-mono text-xs">{h.date}</td>
                      <td className="px-3 py-2 text-right text-rose-600 dark:text-rose-400">
                        {pct(h.dayRet)}
                      </td>
                      <td className="px-3 py-2 text-right">{pct(h.athDd)}</td>
                      <td className="px-3 py-2 text-right">
                        {h.crs !== null ? (
                          <span className={h.crs >= 2 ? "font-medium text-amber-600 dark:text-amber-400" : "text-zinc-400"}>
                            {h.crs}/6
                          </span>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {h.phi2v3 ? (
                          <span className="font-medium text-emerald-600 dark:text-emerald-400">✓</span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">○</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 text-xs leading-5 text-zinc-400">
          データ: Yahoo Finance (^GSPC · ^VIX · HYG · DX-Y.NYB · RSP · EFA · EEM)。
          phi2 v3:{" "}
          <span className="font-mono">decisions/0021</span>（TEST Z=+8.65）·
          HYG-8%:{" "}
          <span className="font-mono">decisions/0016</span>（TEST Z=+9.42）·
          B4:{" "}
          <span className="font-mono">decisions/0018</span>（TEST Z=+8.29）。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
