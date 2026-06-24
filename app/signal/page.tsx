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
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wide ${
        active
          ? "border-red-400/30 bg-red-400/10 text-red-400"
          : "border-white/[0.08] bg-white/[0.03] text-white/25"
      }`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${active ? "bg-red-400" : "bg-white/20"}`} />
      {label}
    </span>
  );
}

function SignalBadge({
  active, label, sub, quality,
}: {
  active: boolean;
  label: string;
  sub: string;
  quality: "high" | "mid" | "low";
}) {
  const border = active
    ? quality === "high" ? "border-[#34d399]/40 bg-[#34d399]/[0.08]"
    : quality === "mid"  ? "border-amber-400/40 bg-amber-400/[0.08]"
    : "border-sky-400/40 bg-sky-400/[0.08]"
    : "border-white/[0.07] bg-white/[0.03]";

  const dot = active
    ? quality === "high" ? "bg-[#34d399]"
    : quality === "mid"  ? "bg-amber-400"
    : "bg-sky-400"
    : "bg-white/20";

  const text = active
    ? quality === "high" ? "text-[#34d399]"
    : quality === "mid"  ? "text-amber-400"
    : "text-sky-400"
    : "text-white/25";

  return (
    <div className={`rounded-2xl border p-3.5 backdrop-blur-sm ${border}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dot}`} />
        <p className={`text-sm font-medium ${active ? text : "text-white/25"}`}>{label}</p>
        {active && <span className={`ml-auto font-mono text-xs font-semibold ${text}`}>発動中</span>}
      </div>
      <p className="mt-1 pl-4 font-mono text-[10px] text-white/25">{sub}</p>
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
      <div className="min-h-screen">
        <main className="mx-auto max-w-4xl px-6 py-12">
          <Link href="/" className="font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors">
            ← ホームにもどる
          </Link>
          <p className="mt-8 text-sm text-red-400">データ取得に失敗しました。しばらくしてから再読み込みしてください。</p>
          {error && <p className="mt-2 font-mono text-xs text-white/20">{error}</p>}
        </main>
      </div>
    );
  }

  const {
    date, athDd, ageAth, ageAthOk,
    vol20, dayRet, rsi14, vix,
    crs, crsComponents,
    phi2Active, rsi25Crossunder,
    hygSignal, b4Active, b4BaseDate,
    efaAthDd, efaActive, eemAthDd, eemActive,
    signalTier, history, pastEpisodes,
  } = signal;

  type StatusConfig = { label: string; sub: string; detail: string; border: string; detailColor: string };

  const statusMap: Record<typeof signalTier, StatusConfig> = {
    DOUBLE: {
      label: "phi2 v3 + RSI<25 同時発動（超高品質）",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · RSI ${rsi14?.toFixed(1) ?? "—"}`,
      detail: "過去30年8回しかない最高品質シグナル。DCA 追加投入を強く検討。",
      border: "border-violet-400/40 bg-violet-400/[0.08]",
      detailColor: "text-violet-300",
    },
    PHI2: {
      label: "phi2 v3 発動",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · vol ${vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}`,
      detail: "年平均3回。63日後平均+13.6%（DCA比）。追加投入日。",
      border: "border-[#34d399]/40 bg-[#34d399]/[0.08]",
      detailColor: "text-[#34d399]",
    },
    RSI25: {
      label: "RSI<25 シグナル（低信頼度）",
      sub: `RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} · phi2 条件は未達`,
      detail: "短期反発の統計的根拠は薄い。長期保有前提の追加投入なら合理的。",
      border: "border-amber-400/30 bg-amber-400/[0.06]",
      detailColor: "text-amber-400",
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
        if (!ageAthOk) missing.push(`age_ath 除外ゾーン（${ageAth}日 ∈ [91-252]）`);
        if (crs < 2) missing.push(`CRS ≥ 2（現在 ${crs}）`);
        return `未達条件: ${missing.join(" / ")}`;
      })(),
      border: "border-amber-400/20 bg-amber-400/[0.04]",
      detailColor: "text-amber-400/70",
    },
    NONE: {
      label: "待機中 — 発動圏外",
      sub: `ATH ${pct(athDd)} — phi2 圏（−10%）に達していない`,
      detail: "通常の市場状態。定期積立（DCA）を継続。",
      border: "border-white/[0.07] bg-white/[0.03]",
      detailColor: "text-slate-500",
    },
  };

  const st = statusMap[signalTier];

  const conclusion = (() => {
    if (signalTier === "DOUBLE") return { text: "🔴 最高品質シグナル同時発動。30年で8回のみの局面。積極的な追加投入を検討してください。", cls: "border-violet-400/30 bg-violet-400/[0.08] text-violet-300" };
    if (signalTier === "PHI2")   return { text: "⚡ 買い増しシグナル発動中。過去の同条件、63日後の平均はDCA比 +13.6%。", cls: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" };
    if (hygSignal)               return { text: "⚡ HYG-8% シグナル発動中。クレジット市場の恐怖を検知。30年統計 TEST Z=+9.42。", cls: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400" };
    if (b4Active)                return { text: "⚡ B4 追加タイミング。phi2 発動から7営業日、ATH-10% 圏内が継続しています。", cls: "border-sky-400/30 bg-sky-400/[0.08] text-sky-400" };
    if (signalTier === "RSI25")  return { text: "RSI<25 シグナル。短期反発の根拠は薄いが、長期保有前提の追加投入なら合理的。", cls: "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" };
    if (signalTier === "NEAR")   return { text: "発動圏内に入っています。条件はまだ揃っていません。引き続き定期積立を続けてください。", cls: "border-white/[0.08] bg-white/[0.04] text-slate-400" };
    return { text: "今日は通常状態です。定期積立（DCA）を続けてください。", cls: "border-white/[0.06] bg-white/[0.03] text-slate-500" };
  })();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/20">Signal / リアルタイム</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">今日のシグナル状態</h1>
            <p className="mt-1 font-mono text-[10px] text-white/20">{date} · 15分キャッシュ · Yahoo Finance ^GSPC</p>
          </div>
          <PushSubscribe />
        </div>

        {/* 今日の結論 */}
        <div className={`mt-5 rounded-2xl border px-5 py-4 backdrop-blur-sm ${conclusion.cls}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] opacity-40 mb-1.5">今日の結論</p>
          <p className="text-base font-semibold leading-snug">{conclusion.text}</p>
        </div>

        {/* メインステータス */}
        <div className={`mt-4 rounded-2xl border p-5 backdrop-blur-sm ${st.border}`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/20 mb-2">シグナル状態</p>
          <p className="text-xl font-semibold text-[#e8f4ff]">{st.label}</p>
          <p className="mt-1 font-mono text-xs text-slate-500">{st.sub}</p>
          <p className={`mt-3 text-sm font-medium ${st.detailColor}`}>{st.detail}</p>
        </div>

        {/* 全シグナル一覧 */}
        <section className="mt-5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-white/20">全シグナル状態（4体制 v3）</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SignalBadge active={phi2Active}     label="phi2 v3（主力）"            sub={`ATH-10% · 当日-2% · vol>25% · CRS≥2 · age非L字 | TEST Z=+8.65`} quality="high" />
            <SignalBadge active={rsi25Crossunder} label="RSI<25 クロスアンダー"     sub={`RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} | TEST Z=+3.92`} quality="mid" />
            <SignalBadge active={hygSignal}       label="HYG-8% QE後"               sub={`HYG 60日高値-8%以下 AND ATH-5%以下 | TEST Z=+9.42`} quality="high" />
            <SignalBadge active={b4Active}        label={`B4（phi2後7日）${b4BaseDate ? `← ${b4BaseDate}` : ""}`} sub={`phi2発動7営業日後 AND 今日もATH-10%以下 | TEST Z=+8.29`} quality="mid" />
            <SignalBadge active={efaActive}       label="EFA 先進国（除く米国）"    sub={`ATH乖離 ${efaAthDd !== null ? pct(efaAthDd) : "—"} · SP500 CRS共用 | TEST Z=+8.08`} quality="low" />
            <SignalBadge active={eemActive}       label="EEM 新興国"                sub={`ATH乖離 ${eemAthDd !== null ? pct(eemAthDd) : "—"} · SP500 CRS共用`} quality="low" />
          </div>
        </section>

        {/* CRS スコア */}
        <section className="mt-5 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">CRS（Crisis Recovery Score）</p>
            <span className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${
              crs >= 4 ? "bg-red-400/15 text-red-400"
              : crs >= 2 ? "bg-amber-400/15 text-amber-400"
              : "bg-white/[0.06] text-slate-500"
            }`}>
              {crs} / 6
            </span>
          </div>
          <p className="mt-1 mb-3 font-mono text-[10px] text-white/20">
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

        {/* ライブメトリクス */}
        <div className="mt-4">
          <LiveMetrics initial={signal} />
        </div>

        {/* phi2 条件チェック */}
        <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-4 backdrop-blur-md">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-white/20">phi2 v3 発動条件</p>
          {(
            [
              { label: "ATH 乖離 ≤ −10%",    ok: athDd <= -0.1,                              val: pct(athDd) },
              { label: "当日リターン ≤ −2%", ok: dayRet !== null && dayRet <= -0.02,           val: dayRet !== null ? pct(dayRet) : "—" },
              { label: "vol20 > 25%",         ok: vol20 !== null && vol20 > 0.25,              val: vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—" },
              { label: "age_ath ∉ [91-252]",  ok: ageAthOk,                                   val: `${ageAth}日` },
              { label: "CRS ≥ 2",             ok: crs >= 2,                                   val: `${crs}/6` },
            ] as { label: string; ok: boolean; val: string }[]
          ).map(({ label, ok, val }) => (
            <div key={label} className="flex items-center justify-between border-b border-white/[0.05] py-2 last:border-0">
              <span className="flex items-center gap-2 text-sm">
                <span className={`font-mono ${ok ? "text-[#34d399]" : "text-white/20"}`}>{ok ? "✓" : "○"}</span>
                <span className={ok ? "text-[#e8f4ff]" : "text-slate-600"}>{label}</span>
              </span>
              <span className={`font-mono text-sm ${ok ? "text-[#34d399]" : "text-white/20"}`}>{val}</span>
            </div>
          ))}
        </section>

        {/* 過去類似事例 */}
        {pastEpisodes.length > 0 && (
          <section className="mt-8 border-t border-white/[0.05] pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">過去2年の phi2 類似事例</p>
            <p className="mt-1 mb-3 text-xs text-slate-500">ATH−10% · 当日−2% · vol&gt;25% · age非L字を満たした日 — その後のリターン（実績）</p>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.03]">
                  <tr>
                    {["日付","当日","ATH 乖離","今日まで","経過"].map(h => (
                      <th key={h} className={`px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white/20 ${h === "日付" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pastEpisodes.slice(0, 10).map((ep) => (
                    <tr key={ep.date} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{ep.date}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[#f87171]">{pct(ep.dayRet)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">{pct(ep.athDd)}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${ep.retToDate > 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>{pct(ep.retToDate)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-white/20">
                        {ep.daysAgo < 30 ? `${ep.daysAgo}日前` : `${Math.round(ep.daysAgo / 21)}ヶ月前`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[10px] text-white/20">
              平均リターン:{" "}
              <span className={`font-semibold ${pastEpisodes.slice(0,10).reduce((a,e)=>a+e.retToDate,0)/Math.min(pastEpisodes.length,10)>0?"text-[#34d399]":"text-[#f87171]"}`}>
                {pct(pastEpisodes.slice(0,10).reduce((a,e)=>a+e.retToDate,0)/Math.min(pastEpisodes.length,10))}
              </span>
              {" · "}勝率:{" "}
              <span className="font-semibold text-slate-500">
                {Math.round(pastEpisodes.slice(0,10).filter(e=>e.retToDate>0).length/Math.min(pastEpisodes.length,10)*100)}%
              </span>
            </p>
          </section>
        )}

        {/* 過去30日候補日 */}
        <section className="mt-8 border-t border-white/[0.05] pt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-white/20">過去 30 日の phi2 v3 候補日</p>
          <p className="mt-1 mb-3 text-xs text-slate-500">ATH −10% · 当日 −2% · vol &gt; 25% を満たした日</p>
          {history.length === 0 ? (
            <p className="font-mono text-xs text-white/20">過去 30 日以内に phi2 候補日なし</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.06] bg-white/[0.03]">
                  <tr>
                    {["日付","当日","ATH 乖離","CRS","phi2 v3"].map(h => (
                      <th key={h} className={`px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-white/20 ${h === "日付" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date} className="border-t border-white/[0.04]">
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{h.date}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[#f87171]">{pct(h.dayRet)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-500">{pct(h.athDd)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {h.crs !== null
                          ? <span className={h.crs >= 2 ? "text-amber-400" : "text-white/20"}>{h.crs}/6</span>
                          : <span className="text-white/20">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {h.phi2v3 ? <span className="text-[#34d399]">✓</span> : <span className="text-white/20">○</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-8 font-mono text-[10px] leading-6 text-white/15">
          データ: Yahoo Finance (^GSPC · ^VIX · HYG · DX-Y.NYB · RSP · EFA · EEM)。
          phi2 v3: decisions/0021（TEST Z=+8.65）· HYG-8%: decisions/0016（TEST Z=+9.42）· B4: decisions/0018（TEST Z=+8.29）。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
