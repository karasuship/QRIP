import { fetchSignal } from "@/lib/signal";
import type { Metadata } from "next";
import Link from "next/link";
import LiveMetrics from "@/app/components/LiveMetrics";
import PushSubscribe from "@/app/components/PushSubscribe";
import CrsSizingCalc from "@/app/components/CrsSizingCalc";
import MarketContext from "@/app/components/MarketContext";
import EconCalendar from "@/app/components/EconCalendar";

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
          : "border-white/[0.18] bg-white/[0.06] text-white/25"
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
    : "border-white/[0.15] bg-white/[0.06]";

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

// ATH乖離率から品質ゾーン情報を返す
function athQuality(dd: number): { label: string; color: string } | null {
  if (dd > -0.1)  return null;
  if (dd <= -0.2) return { label: "深い暴落圏（-20%以下）",          color: "text-amber-400" };
  if (dd <= -0.15) return { label: "★ 最高品質ゾーン（-15〜-20%）", color: "text-[#34d399]" };
  return { label: "発動圏（-10〜-15%）",                             color: "text-slate-400" };
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
          <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
            ← ホームにもどる
          </Link>
          <p className="mt-8 text-sm text-red-400">データ取得に失敗しました。しばらくしてから再読み込みしてください。</p>
          {error && <p className="mt-2 font-mono text-xs text-slate-400">{error}</p>}
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

  const anySignalActive = phi2Active || hygSignal || b4Active || signalTier === "DOUBLE";
  const aq = athQuality(athDd);

  type StatusConfig = { label: string; sub: string; detail: string; border: string; detailColor: string };

  const statusMap: Record<typeof signalTier, StatusConfig> = {
    DOUBLE: {
      label: "phi2 v3 + RSI<25 同時発動（超高品質）",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · RSI ${rsi14?.toFixed(1) ?? "—"}`,
      detail: "30年でわずか8回（コロナ2020-03・GFC2008-10・2009-02・アジア通貨危機1997-10等）。全て後から見た絶好の買い場。積極的な追加投入を強く検討。",
      border: "border-violet-400/40 bg-violet-400/[0.08]",
      detailColor: "text-violet-300",
    },
    PHI2: {
      label: "phi2 v3 発動",
      sub: `ATH ${pct(athDd)} · CRS ${crs}/6 · vol ${vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—"}`,
      detail: "年平均3回。63日後平均+13.6%（DCA比）。追加投入日。アルファは最初の63日に集中する。",
      border: "border-[#34d399]/40 bg-[#34d399]/[0.08]",
      detailColor: "text-[#34d399]",
    },
    RSI25: {
      label: "RSI<25 シグナル（低信頼度）",
      sub: `RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} · phi2 条件は未達`,
      detail: "RSI<25単体のTRAIN Z=+0.06（ランダムと同等）。phi2条件と重なる局面でのみ意味を持つ。長期保有前提の追加投入なら合理的。",
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
      border: "border-white/[0.15] bg-white/[0.06]",
      detailColor: "text-slate-400",
    },
  };

  const st = statusMap[signalTier];

  const conclusion = (() => {
    if (signalTier === "DOUBLE") return { text: "🔴 最高品質シグナル同時発動。30年で8回のみの局面。積極的な追加投入を検討してください。", cls: "border-violet-400/30 bg-violet-400/[0.08] text-violet-300" };
    if (signalTier === "PHI2")   return { text: "⚡ 買い増しシグナル発動中。過去の同条件、63日後の平均はDCA比 +13.6%。", cls: "border-[#34d399]/30 bg-[#34d399]/[0.08] text-[#34d399]" };
    if (hygSignal)               return { text: "⚡ HYG-8% シグナル発動中。クレジット市場の恐怖を検知。30年統計 TEST Z=+9.42。", cls: "border-amber-400/30 bg-amber-400/[0.08] text-amber-400" };
    if (b4Active)                return { text: "⚡ B4 追加タイミング。phi2 発動から7営業日、ATH-10% 圏内が継続しています。", cls: "border-sky-400/30 bg-sky-400/[0.08] text-sky-400" };
    if (signalTier === "RSI25")  return { text: "RSI<25 シグナル。短期反発の根拠は薄いが、長期保有前提の追加投入なら合理的。", cls: "border-amber-400/20 bg-amber-400/[0.05] text-amber-400/80" };
    if (signalTier === "NEAR")   return { text: "発動圏内に入っています。条件はまだ揃っていません。引き続き定期積立を続けてください。", cls: "border-white/[0.18] bg-white/[0.07] text-slate-400" };
    return { text: "今日は通常状態です。定期積立（DCA）を続けてください。", cls: "border-white/[0.13] bg-white/[0.06] text-slate-400" };
  })();

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-slate-400 hover:text-slate-300 transition-colors">
          ← ホームにもどる
        </Link>

        <div className="mt-6 flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-slate-400">Signal / リアルタイム</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#e8f4ff]">今日のシグナル状態</h1>
            <p className="mt-1 font-mono text-[10px] text-slate-400">{date} · 15分キャッシュ · Yahoo Finance ^GSPC</p>
          </div>
          <PushSubscribe />
        </div>

        {/* 今日の結論 */}
        <div className={`mt-5 rounded-2xl border px-5 py-4 backdrop-blur-sm ${conclusion.cls}`}>
          <p className="font-mono text-[9px] uppercase tracking-[0.25em] mb-1.5 text-slate-400">今日の結論</p>
          <p className="text-base font-semibold leading-snug">{conclusion.text}</p>
        </div>

        {/* メインステータス */}
        <div className={`mt-4 rounded-2xl border p-5 backdrop-blur-sm ${st.border}`}>
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">シグナル状態</p>
          <p className="text-xl font-semibold text-[#e8f4ff]">{st.label}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{st.sub}</p>
          <p className={`mt-3 text-sm font-medium ${st.detailColor}`}>{st.detail}</p>
        </div>

        {/* ① CRS=5〜6 → 2倍投入バナー + サイジング試算 */}
        {crs >= 5 && (
          <div className="mt-3 rounded-2xl border border-violet-400/35 bg-violet-400/[0.07] px-5 py-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-violet-300">● CRS = {crs} — 2倍投入を検討する根拠がある</span>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              CRS=5が30年検証で最高品質ゾーン（TEST Z=+4.48、DCA比+15.9%）。
              CRS=4より優秀。通常量の2倍投入がTRAIN Z最高値（+5.51）。
              ただし CRS は「今の恐怖の深さ」であり未来を保証しない（R37）。
            </p>
          </div>
        )}
        {/* CRS連動サイジング試算 (CRS>=2 で表示) */}
        {crs >= 2 && <CrsSizingCalc crs={crs} />}

        {/* ④ 購入後の行動ガイド（シグナル発動時のみ） */}
        {anySignalActive && (
          <div className="mt-3 rounded-2xl border border-white/[0.12] bg-white/[0.06] p-4 backdrop-blur-md">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-3">購入後の行動ガイド</p>
            <div className="space-y-2.5">
              <div className="flex gap-3">
                <span className="font-mono text-[10px] text-[#34d399] shrink-0 pt-0.5 w-12">基本</span>
                <p className="text-xs leading-5 text-slate-300">
                  売らずに保有（HOLD）が最良。30年シミュレーションで売り戦略との差は
                  <span className="font-mono text-slate-200"> 14〜16万（年5,000円未満）</span>。
                  税金・手数料を考えると明確にHOLD優位（R43）。
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-[10px] text-amber-400 shrink-0 pt-0.5 w-12">出口</span>
                <p className="text-xs leading-5 text-slate-400">
                  アクティブに回すなら「CRS=0復帰」が最も理論的。恐怖が消えたら売る。
                  平均<span className="font-mono text-slate-300"> 84〜111日後</span>に発動、TEST Z=+10.46（R39）。
                  RSI&gt;55の素早い出口（平均10日）はTEST Z=−1.12で非推奨。
                </p>
              </div>
              <div className="flex gap-3">
                <span className="font-mono text-[10px] text-[#38bdf8] shrink-0 pt-0.5 w-12">分散</span>
                <p className="text-xs leading-5 text-slate-400">
                  EFA（先進国インデックス）もSP500と同等品質（TEST Z=+8.08、+15.6%）。
                  phi2発動時にSP500+EFA同時買いは統計的に支持される（R42）。
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 全シグナル一覧 */}
        <section className="mt-5">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-slate-400">全シグナル状態（4体制 v3）</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <SignalBadge active={phi2Active}     label="phi2 v3（主力）"            sub={`ATH-10% · 当日-2% · vol>25% · CRS≥2 · age非L字 | TEST Z=+8.65`} quality="high" />
            <SignalBadge active={rsi25Crossunder} label="RSI<25 クロスアンダー"     sub={`RSI14 = ${rsi14 !== null ? rsi14.toFixed(1) : "—"} | TEST Z=+3.92`} quality="mid" />
            <SignalBadge active={hygSignal}       label="HYG-8% QE後"               sub={`HYG 60日高値-8%以下 AND ATH-5%以下 | TEST Z=+9.42`} quality="high" />
            <SignalBadge active={b4Active}        label={`B4（phi2後7日）${b4BaseDate ? `← ${b4BaseDate}` : ""}`} sub={`phi2発動7営業日後 AND 今日もATH-10%以下 | TEST Z=+8.29`} quality="mid" />
            <SignalBadge active={efaActive}       label="EFA 先進国（除く米国）"    sub={`ATH乖離 ${efaAthDd !== null ? pct(efaAthDd) : "—"} · SP500 CRS共用 | TEST Z=+8.08`} quality="low" />
            <SignalBadge active={eemActive}       label="EEM 新興国"                sub={`ATH乖離 ${eemAthDd !== null ? pct(eemAthDd) : "—"} · SP500 CRS共用`} quality="low" />
          </div>

          {/* ③ phi2 AND RSI<25 超特注意フラグ */}
          {phi2Active && rsi25Crossunder && (
            <div className="mt-2 rounded-2xl border border-violet-400/50 bg-violet-400/[0.10] px-5 py-3 backdrop-blur-sm">
              <p className="font-mono text-xs font-bold text-violet-200">
                ⚠ phi2 AND RSI&lt;25 同時発動 — 過去30年でわずか8回
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                コロナ暴落（2020-03）・GFC（2008-10、2009-02）・アジア通貨危機（1997-10）等。
                全て後から振り返ると絶好の買い場。n=8のため統計的有意性は確認できないが、
                「歴史的パニック水準」の指標として扱う。
              </p>
            </div>
          )}
        </section>

        {/* CRS スコア */}
        <section className="mt-5 rounded-2xl border border-white/[0.18] bg-white/[0.09] p-4 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">CRS（Crisis Recovery Score）</p>
            <span className={`rounded-full px-3 py-1 font-mono text-sm font-bold ${
              crs >= 5 ? "bg-violet-400/15 text-violet-300"
              : crs >= 4 ? "bg-red-400/15 text-red-400"
              : crs >= 2 ? "bg-amber-400/15 text-amber-400"
              : "bg-white/[0.06] text-slate-400"
            }`}>
              {crs} / 6
            </span>
          </div>
          <p className="mt-1 mb-3 font-mono text-[10px] text-slate-400">
            ≥ 2 でシグナル有効 · ≥ 4 で高品質 ·{" "}
            <span className={crs >= 5 ? "text-violet-300 font-semibold" : ""}>5-6 で 2x 投入検討</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <CRSDot active={crsComponents.c1} label="VIX>30" />
            <CRSDot active={crsComponents.c2} label="HYG3日落" />
            <CRSDot active={crsComponents.c3} label="DXY5日高" />
            <CRSDot active={crsComponents.c4} label="ATH90日内" />
            <CRSDot active={crsComponents.c5} label="HYG60日-8%" />
            <CRSDot active={crsComponents.c6} label="RSP弱" />
          </div>
          {/* CRS品質ガイド */}
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              { range: "0〜1", label: "シグナル無効",   color: "text-slate-500 border-white/[0.08] bg-white/[0.03]" },
              { range: "2〜3", label: "有効",           color: "text-amber-400 border-amber-400/20 bg-amber-400/[0.05]" },
              { range: "4",   label: "高品質",          color: "text-[#f87171] border-[#f87171]/20 bg-[#f87171]/[0.05]" },
              { range: "5〜6", label: "2倍投入検討",    color: "text-violet-300 border-violet-400/30 bg-violet-400/[0.07]" },
            ].map((r) => (
              <div key={r.range} className={`rounded-xl border px-2 py-1.5 text-center ${r.color} ${crs >= parseInt(r.range) || (r.range === "2〜3" && crs >= 2) || (r.range === "5〜6" && crs >= 5) ? "opacity-100" : "opacity-40"}`}>
                <p className="font-mono text-[10px] font-bold">{r.range}</p>
                <p className="font-mono text-[9px] mt-0.5">{r.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ライブメトリクス */}
        <div className="mt-4">
          <LiveMetrics initial={signal} />
        </div>

        {/* 市場文脈（NASDAQ100 / ラッセル2000 / KOSPI / 金 / 原油） */}
        <MarketContext />

        {/* phi2 条件チェック */}
        <section className="mt-4 rounded-2xl border border-white/[0.18] bg-white/[0.09] p-4 backdrop-blur-md">
          <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-slate-400">phi2 v3 発動条件</p>
          {(
            [
              { label: "ATH 乖離 ≤ −10%",    ok: athDd <= -0.1,                              val: pct(athDd) },
              { label: "当日リターン ≤ −2%", ok: dayRet !== null && dayRet <= -0.02,           val: dayRet !== null ? pct(dayRet) : "—" },
              { label: "vol20 > 25%",         ok: vol20 !== null && vol20 > 0.25,              val: vol20 !== null ? (vol20 * 100).toFixed(1) + "%" : "—" },
              { label: "age_ath ∉ [91-252]",  ok: ageAthOk,                                   val: `${ageAth}日` },
              { label: "CRS ≥ 2",             ok: crs >= 2,                                   val: `${crs}/6` },
            ] as { label: string; ok: boolean; val: string }[]
          ).map(({ label, ok, val }) => (
            <div key={label} className="flex items-center justify-between border-b border-white/[0.12] py-2 last:border-0">
              <span className="flex items-center gap-2 text-sm">
                <span className={`font-mono ${ok ? "text-[#34d399]" : "text-slate-400"}`}>{ok ? "✓" : "○"}</span>
                <span className={ok ? "text-[#e8f4ff]" : "text-slate-600"}>{label}</span>
              </span>
              <span className={`font-mono text-sm ${ok ? "text-[#34d399]" : "text-slate-400"}`}>{val}</span>
            </div>
          ))}

          {/* ② ATH深度の品質ゾーン注記 */}
          {aq && (
            <div className="mt-3 rounded-xl border border-white/[0.09] bg-white/[0.04] px-3 py-2">
              <p className="font-mono text-[10px] text-slate-500 mb-1">ATH深度の品質</p>
              <div className="flex flex-col gap-1">
                {[
                  { range: "−10〜−15%", label: "発動圏",            color: "text-slate-400",   active: athDd > -0.15 && athDd <= -0.1 },
                  { range: "−15〜−20%", label: "★ 最高品質ゾーン", color: "text-[#34d399]",   active: athDd <= -0.15 && athDd > -0.2 },
                  { range: "−20%以下",  label: "深い暴落圏",        color: "text-amber-400",  active: athDd <= -0.2 },
                ].map((z) => (
                  <div key={z.range} className={`flex items-center gap-2 ${z.active ? "opacity-100" : "opacity-30"}`}>
                    <span className={`font-mono text-[10px] w-20 ${z.color}`}>{z.range}</span>
                    <span className={`font-mono text-[10px] ${z.color}`}>{z.label}</span>
                    {z.active && <span className="ml-auto font-mono text-[10px] text-slate-500">← 現在</span>}
                  </div>
                ))}
              </div>
              <p className="mt-2 font-mono text-[9px] text-slate-600">
                TEST: −15〜−20%が最高品質（Z=+6.75）。−10〜−15%も有効（Z=+3.05）。
                −30%超（GFC）はTEST期間ではゼロ（R40）。
              </p>
            </div>
          )}
        </section>

        {/* 過去類似事例 */}
        {pastEpisodes.length > 0 && (
          <section className="mt-8 border-t border-white/[0.12] pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">過去2年の phi2 類似事例</p>
            <p className="mt-1 mb-3 text-xs text-slate-400">ATH−10% · 当日−2% · vol&gt;25% · age非L字を満たした日 — その後のリターン（実績）</p>
            <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                  <tr>
                    {["日付","当日","ATH 乖離","今日まで","経過"].map(h => (
                      <th key={h} className={`px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-slate-400 ${h === "日付" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {pastEpisodes.slice(0, 10).map((ep) => (
                    <tr key={ep.date} className="border-t border-white/[0.09]">
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{ep.date}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[#f87171]">{pct(ep.dayRet)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">{pct(ep.athDd)}</td>
                      <td className={`px-3 py-2 text-right font-mono text-xs font-semibold ${ep.retToDate > 0 ? "text-[#34d399]" : "text-[#f87171]"}`}>{pct(ep.retToDate)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[10px] text-slate-400">
                        {ep.daysAgo < 30 ? `${ep.daysAgo}日前` : `${Math.round(ep.daysAgo / 21)}ヶ月前`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 font-mono text-[10px] text-slate-400">
              平均リターン:{" "}
              <span className={`font-semibold ${pastEpisodes.slice(0,10).reduce((a,e)=>a+e.retToDate,0)/Math.min(pastEpisodes.length,10)>0?"text-[#34d399]":"text-[#f87171]"}`}>
                {pct(pastEpisodes.slice(0,10).reduce((a,e)=>a+e.retToDate,0)/Math.min(pastEpisodes.length,10))}
              </span>
              {" · "}勝率:{" "}
              <span className="font-semibold text-slate-400">
                {Math.round(pastEpisodes.slice(0,10).filter(e=>e.retToDate>0).length/Math.min(pastEpisodes.length,10)*100)}%
              </span>
            </p>
          </section>
        )}

        {/* 過去30日候補日 */}
        <section className="mt-8 border-t border-white/[0.12] pt-6">
          <p className="font-mono text-[10px] uppercase tracking-widest text-slate-400">過去 30 日の phi2 v3 候補日</p>
          <p className="mt-1 mb-3 text-xs text-slate-400">ATH −10% · 当日 −2% · vol &gt; 25% を満たした日</p>
          {history.length === 0 ? (
            <p className="font-mono text-xs text-slate-400">過去 30 日以内に phi2 候補日なし</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/[0.18] backdrop-blur-sm">
              <table className="w-full text-sm">
                <thead className="border-b border-white/[0.13] bg-white/[0.06]">
                  <tr>
                    {["日付","当日","ATH 乖離","CRS","phi2 v3"].map(h => (
                      <th key={h} className={`px-3 py-2 font-mono text-[9px] uppercase tracking-widest text-slate-400 ${h === "日付" ? "text-left" : "text-right"}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date} className="border-t border-white/[0.09]">
                      <td className="px-3 py-2 font-mono text-xs text-slate-400">{h.date}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-[#f87171]">{pct(h.dayRet)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs text-slate-400">{pct(h.athDd)}</td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {h.crs !== null
                          ? <span className={h.crs >= 5 ? "text-violet-300" : h.crs >= 2 ? "text-amber-400" : "text-slate-400"}>{h.crs}/6</span>
                          : <span className="text-slate-400">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-xs">
                        {h.phi2v3 ? <span className="text-[#34d399]">✓</span> : <span className="text-slate-400">○</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 経済カレンダー */}
        <EconCalendar />

        <p className="mt-8 font-mono text-[10px] leading-6 text-slate-400">
          データ: Yahoo Finance (^GSPC · ^VIX · HYG · DX-Y.NYB · RSP · EFA · EEM)。
          phi2 v3: decisions/0021（TEST Z=+8.65）· HYG-8%: decisions/0016（TEST Z=+9.42）· B4: decisions/0018（TEST Z=+8.29）。
          R37: CRS=5→2x · R39: HOLD最良 · R42: EFA同等品質。
          これは投資助言ではありません。
        </p>
      </main>
    </div>
  );
}
