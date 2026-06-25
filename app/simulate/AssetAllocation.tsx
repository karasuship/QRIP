"use client";

import Link from "next/link";

// ── 主要インデックスデータ（公知の長期実績 + 自前バックテスト） ─────────────────

interface Asset {
  ticker: string;
  name: string;
  region: string;
  annualReturn: number;   // %
  maxDD: number;          // % (負値)
  vol: number;            // 年率ボラ %
  phi2: "◎" | "○" | "△" | "—";
  phi2z?: string;
  phi2note?: string;
  cape?: number;
  growthNote: string;
  color: string;
}

const ASSETS: Asset[] = [
  {
    ticker: "VOO",
    name: "S&P 500",
    region: "米国",
    annualReturn: 10.4,
    maxDD: -57,
    vol: 15,
    phi2: "◎",
    phi2z: "Z=+8.65",
    phi2note: "phi2の主戦場。最も検証が厚い",
    cape: 28,
    growthNote: "米国大型株500社。AI・テック・金融を均等に含む。成長と安定のバランスが最良",
    color: "#34d399",
  },
  {
    ticker: "QQQ",
    name: "NASDAQ-100",
    region: "米国テック",
    annualReturn: 13.8,
    maxDD: -83,
    vol: 21,
    phi2: "△",
    phi2z: "Z=+4.16",
    phi2note: "過発動（TEST n=58）で希釈。シグナル目的ではVOO推奨",
    cape: 38,
    growthNote: "GAFAM+NVIDIAで上位30%超。AI革命の直接受益。ただし-83%DDの経験あり（2000〜02年）",
    color: "#38bdf8",
  },
  {
    ticker: "VEA",
    name: "先進国除米（EFA）",
    region: "欧州・日本・豪",
    annualReturn: 6.8,
    maxDD: -58,
    vol: 16,
    phi2: "○",
    phi2z: "Z=+8.08",
    phi2note: "phi2有効確認済み（Round 42）。米国CRSでグローバル危機を検知",
    cape: 14,
    growthNote: "欧州・日本・豪の先進国株。割安CAPE14。通貨分散効果。ただし成長率は米国以下",
    color: "#a78bfa",
  },
  {
    ticker: "VWO",
    name: "新興国（EEM）",
    region: "中国・インド他",
    annualReturn: 4.5,
    maxDD: -65,
    vol: 22,
    phi2: "△",
    phi2z: "Z=+6.74",
    phi2note: "有効だが安定性は米国以下。政治リスクあり",
    cape: 11,
    growthNote: "CAPE11と最割安。インド・東南アジアの人口ボーナス。ただし中国リスクと流動性リスクを内包",
    color: "#f59e0b",
  },
  {
    ticker: "1306",
    name: "TOPIX（日本全体）",
    region: "日本",
    annualReturn: 5.2,
    maxDD: -60,
    vol: 18,
    phi2: "—",
    phi2note: "未検証。CRSは米国指標のため直接適用不可",
    cape: 15,
    growthNote: "CAPE15と先進国最安水準。コーポレートガバナンス改革・PBR改善が進行中。円安局面で外貨建て収益が追い風",
    color: "#64748b",
  },
  {
    ticker: "SOXX",
    name: "半導体（SOXX）",
    region: "米国テック集中",
    annualReturn: 18.2,
    maxDD: -75,
    vol: 35,
    phi2: "—",
    phi2note: "個別セクター集中のためphi2非対応。QQQ経由での間接保有が現実的",
    cape: undefined,
    growthNote: "AI需要によるデータセンター投資が当面の成長エンジン。ただし高ボラで-75%DDを経験。コア10%以下で補完的に使うのが適切",
    color: "#f87171",
  },
];

// ── 推奨ポートフォリオ例 ──────────────────────────────────────────────────────

const RECOMMENDED_PORTFOLIO = [
  { ticker: "VOO",  name: "S&P 500",      pct: 50, color: "#34d399", reason: "phi2の主戦場。安定成長の基盤" },
  { ticker: "VEA",  name: "先進国除米",   pct: 20, color: "#a78bfa", reason: "phi2有効確認済み。欧州・日本の地理分散" },
  { ticker: "QQQ",  name: "NASDAQ-100",   pct: 20, color: "#38bdf8", reason: "AI・テック成長余力。GAFAM/NVIDIA間接保有" },
  { ticker: "VWO",  name: "新興国",        pct: 10, color: "#f59e0b", reason: "長期割安。インド成長への分散露出" },
];

// 加重平均リターン計算
const weightedReturn = RECOMMENDED_PORTFOLIO.reduce((sum, a) => {
  const asset = ASSETS.find((x) => x.ticker === a.ticker);
  return sum + (asset?.annualReturn ?? 0) * a.pct / 100;
}, 0);

// ── 成長余力テーマ ────────────────────────────────────────────────────────────

const THEMES = [
  {
    title: "AI・半導体（QQQ / SOXX）",
    color: "border-[#38bdf8]/25 bg-[#38bdf8]/[0.05]",
    textColor: "text-[#38bdf8]",
    points: [
      "データセンター投資は2030年まで年率+20%超が予測される（IDC）",
      "NVIDIA・TSMC・ASMLが半導体サプライチェーンの支配的地位を維持",
      "QQQはGAFAM+NVDA上位30%以上。SOXX直接購入より集中リスクが低い",
      "ただし2000年ITバブルで-83%、2022年利上げ局面で-35%。CAPE38は割高水準",
    ],
  },
  {
    title: "日本株（TOPIX / N225）",
    color: "border-slate-400/25 bg-slate-400/[0.04]",
    textColor: "text-slate-300",
    points: [
      "東証PBR1倍割れ企業への改善要求が進行中。ROE改善が株価に反映され始めている",
      "CAPE15は欧米比較で最割安水準の一つ（米CAPE28の半分以下）",
      "円安継続なら外貨建て収益の国内換算が増加。輸出型大企業に恩恵",
      "phi2シグナルとの統合は未検証。CRSは米国指標なのでJPY建て保有と割り切る",
    ],
  },
  {
    title: "新興国（VWO / EEM）",
    color: "border-amber-400/25 bg-amber-400/[0.04]",
    textColor: "text-amber-400",
    points: [
      "インドは2027年にGDP世界3位予測。IT・製造業で高成長が継続",
      "CAPE11と全資産クラスで最割安。長期バリュー投資の観点では魅力的",
      "中国比率の高いEMは地政学リスク。インド特化型（INDA）への分散も選択肢",
      "phi2シグナルはZ=+6.74（有効）だが安定性は米国以下。10%以内の補完枠が適切",
    ],
  },
];

// ── コンポーネント ────────────────────────────────────────────────────────────

export default function AssetAllocation() {
  return (
    <div className="mt-14 space-y-10 border-t border-white/[0.10] pt-10">

      {/* ヘッダー */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500">Asset Allocation / 資産配分</p>
        <h2 className="mt-1 text-xl font-semibold text-[#e8f4ff]">何に投資するか — インデックス比較と配分例</h2>
        <p className="mt-1 text-xs leading-6 text-slate-500">
          phi2シグナルは「いつ買うか」を示す。「何を買うか」はここで判断する。
          検証済み（◎○）のインデックスが phi2 の主戦場。未検証（—）は成長余力の補完として位置づける。
        </p>
      </div>

      {/* 主要インデックス比較テーブル */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">主要インデックス比較</p>
        <div className="overflow-x-auto rounded-2xl border border-white/[0.12]">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="border-b border-white/[0.10] bg-white/[0.05]">
              <tr>
                {["ティッカー", "対象", "年率リターン", "最大DD", "年率ボラ", "CAPE", "phi2相性"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left font-mono text-[9px] uppercase tracking-widest text-slate-500">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ASSETS.map((a) => (
                <tr key={a.ticker} className="border-t border-white/[0.08] hover:bg-white/[0.03]">
                  <td className="px-3 py-3">
                    <span className="font-mono text-sm font-bold" style={{ color: a.color }}>{a.ticker}</span>
                    <span className="ml-2 font-mono text-[10px] text-slate-600">{a.region}</span>
                  </td>
                  <td className="px-3 py-3 text-xs text-slate-400">{a.name}</td>
                  <td className="px-3 py-3">
                    <span className="font-mono text-sm font-semibold" style={{ color: a.color }}>
                      +{a.annualReturn}%
                    </span>
                    <span className="font-mono text-[9px] text-slate-700 ml-1">/年</span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-[#f87171]">{a.maxDD}%</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">{a.vol}%</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-400">
                    {a.cape !== undefined ? a.cape : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-mono text-sm ${
                        a.phi2 === "◎" ? "text-[#34d399]" :
                        a.phi2 === "○" ? "text-[#38bdf8]" :
                        a.phi2 === "△" ? "text-amber-400" : "text-slate-600"
                      }`}>{a.phi2}</span>
                      {a.phi2z && (
                        <span className="font-mono text-[9px] text-slate-600">{a.phi2z}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 font-mono text-[9px] text-slate-700">
          <span>◎ = バックテスト有効・推奨主軸</span>
          <span>○ = 有効確認済み・補完</span>
          <span>△ = 有効だが条件付き</span>
          <span>— = 未検証</span>
        </div>
        <p className="mt-1 font-mono text-[9px] text-slate-700">
          年率リターン: 公開データの長期幾何平均（SOXX は直近10年）。CAPE は2024年現在の概算値。最大DDはそのインデックス史上最大の下落幅。
        </p>
      </section>

      {/* phi2相性詳細 */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">phi2シグナルとの相性詳細</p>
        <div className="space-y-2">
          {ASSETS.filter((a) => a.phi2note).map((a) => (
            <div key={a.ticker} className="flex gap-3 rounded-xl border border-white/[0.10] bg-white/[0.03] px-4 py-3">
              <span className="shrink-0 font-mono text-sm font-bold w-12" style={{ color: a.color }}>{a.ticker}</span>
              <div>
                <span className={`font-mono text-xs mr-2 ${
                  a.phi2 === "◎" ? "text-[#34d399]" :
                  a.phi2 === "○" ? "text-[#38bdf8]" :
                  a.phi2 === "△" ? "text-amber-400" : "text-slate-600"
                }`}>{a.phi2} {a.phi2z ?? "未検証"}</span>
                <span className="text-xs text-slate-500">{a.phi2note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 推奨ポートフォリオ例 */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-1">推奨ポートフォリオ例（1例）</p>
        <p className="mb-3 text-xs text-slate-500">
          「成長×phi2検証済み標準型」— phi2シグナルを最大限活用しつつ、成長余力を補完する構成。
        </p>

        {/* 配分バー */}
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-5">
          {/* ビジュアルバー */}
          <div className="flex h-8 w-full overflow-hidden rounded-lg">
            {RECOMMENDED_PORTFOLIO.map((a) => (
              <div
                key={a.ticker}
                style={{ width: `${a.pct}%`, backgroundColor: a.color + "33", borderRight: "1px solid rgba(0,0,0,0.3)" }}
                className="flex items-center justify-center"
                title={`${a.ticker}: ${a.pct}%`}
              >
                <span className="font-mono text-[9px] font-bold" style={{ color: a.color }}>
                  {a.pct >= 15 ? `${a.pct}%` : ""}
                </span>
              </div>
            ))}
          </div>

          {/* 凡例 */}
          <div className="mt-4 space-y-2">
            {RECOMMENDED_PORTFOLIO.map((a) => (
              <div key={a.ticker} className="flex items-start gap-3">
                <div className="flex shrink-0 items-center gap-2 w-32">
                  <div className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ backgroundColor: a.color }} />
                  <span className="font-mono text-xs font-bold" style={{ color: a.color }}>{a.ticker}</span>
                  <span className="font-mono text-sm font-bold text-slate-400">{a.pct}%</span>
                </div>
                <div>
                  <span className="text-xs text-slate-400">{a.name}</span>
                  <span className="mx-2 text-slate-700">·</span>
                  <span className="text-xs text-slate-600">{a.reason}</span>
                </div>
              </div>
            ))}
          </div>

          {/* 期待値 */}
          <div className="mt-4 pt-4 border-t border-white/[0.08] flex flex-wrap gap-6">
            <div>
              <p className="font-mono text-[9px] uppercase text-slate-600">加重平均期待リターン</p>
              <p className="font-mono text-2xl font-bold text-[#34d399] mt-0.5">
                +{weightedReturn.toFixed(1)}%<span className="text-sm font-normal text-slate-500">/年</span>
              </p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase text-slate-600">phi2発動対象</p>
              <p className="font-mono text-sm font-bold text-[#e8f4ff] mt-0.5">VOO + VEA（70%）</p>
              <p className="font-mono text-[9px] text-slate-600">検証済みシグナル適用範囲</p>
            </div>
            <div>
              <p className="font-mono text-[9px] uppercase text-slate-600">成長余力補完</p>
              <p className="font-mono text-sm font-bold text-[#38bdf8] mt-0.5">QQQ（AI・テック）</p>
              <p className="font-mono text-[9px] text-slate-600">phi2ではなく積立での保有推奨</p>
            </div>
          </div>
        </div>

        {/* なぜこの構成か */}
        <div className="mt-3 space-y-2">
          <div className="rounded-xl border border-[#34d399]/20 bg-[#34d399]/[0.05] px-4 py-3">
            <p className="text-xs leading-6 text-[#34d399]/90">
              <strong className="text-[#34d399]">VOO 50%の根拠：</strong>
              phi2 v3のバックテストは SP500 が基盤（TEST Z=+8.65）。シグナル活用の恩恵を最大化するにはVOOが主軸。
              米国大型株 500 社が対象で個別株集中リスクも低い。
            </p>
          </div>
          <div className="rounded-xl border border-[#38bdf8]/20 bg-[#38bdf8]/[0.05] px-4 py-3">
            <p className="text-xs leading-6 text-[#38bdf8]/90">
              <strong className="text-[#38bdf8]">QQQ 20%の根拠：</strong>
              AI・半導体の成長余力を間接保有する最も現実的な手段。GAFAM上位・NVIDIAを一括で保持できる。
              ただしphi2は過発動するためQQQ分はシグナルではなく毎月積立（DCA）で保有する。
            </p>
          </div>
          <div className="rounded-xl border border-[#a78bfa]/20 bg-[#a78bfa]/[0.05] px-4 py-3">
            <p className="text-xs leading-6 text-[#a78bfa]/90">
              <strong className="text-[#a78bfa]">VEA 20%の根拠：</strong>
              phi2有効確認済み（Z=+8.08）かつCAPE14と割安。米国集中リスクのヘッジ。
              phi2シグナルはVEAにも適用可能なため、発動時は VOO+VEA 同時買いが統計的に支持される。
            </p>
          </div>
        </div>
      </section>

      {/* GAFAM・半導体について */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          GAFAM・半導体株の位置づけ
        </p>
        <div className="rounded-2xl border border-white/[0.12] bg-white/[0.04] p-5 space-y-4">
          <div>
            <p className="font-mono text-xs font-bold text-slate-300 mb-1">個別株（AAPL・NVDA・MSFT等）</p>
            <p className="text-xs leading-6 text-slate-500">
              phi2シグナルは分散インデックス専用（Round 41で確認）。個別高ボラ株では月次上限ヒット過多・体制変化で機能しない。
              個別株を持つなら phi2 シグナルは適用せず、ファンダメンタルで独立判断する。
            </p>
          </div>
          <div className="border-t border-white/[0.08] pt-4">
            <p className="font-mono text-xs font-bold text-slate-300 mb-1">現実的な選択肢</p>
            <div className="space-y-1">
              {[
                { opt: "QQQ（推奨）", desc: "GAFAM+NVDA+TSMC等を一括保有。上位10銘柄で50%超。最大DDは-83%（2000〜02年）を許容できるなら候補" },
                { opt: "SOXX / SMH", desc: "半導体特化ETF。直近10年+18%だが年率ボラ35%・最大DD-75%。コア配分10%以下で補完的に使う" },
                { opt: "個別株", desc: "phi2非対応。技術力・財務・競合分析が必要。QRIPのシグナルとは独立した判断として管理する" },
              ].map((o) => (
                <div key={o.opt} className="flex gap-3">
                  <span className="shrink-0 font-mono text-xs text-[#38bdf8] w-28">{o.opt}</span>
                  <span className="text-xs text-slate-500">{o.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 成長余力テーマ */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">成長余力分析</p>
        <div className="space-y-3">
          {THEMES.map((t) => (
            <div key={t.title} className={`rounded-2xl border ${t.color} px-5 py-4`}>
              <p className={`font-mono text-xs font-bold ${t.textColor} mb-2`}>{t.title}</p>
              <ul className="space-y-1">
                {t.points.map((p, i) => (
                  <li key={i} className="flex gap-2 text-xs text-slate-500">
                    <span className="shrink-0 text-slate-700">·</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* NISA・口座割り当て */}
      <section>
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-3">
          NISA口座への割り当て推奨順
        </p>
        <div className="overflow-hidden rounded-2xl border border-white/[0.12]">
          <table className="w-full text-sm">
            <thead className="border-b border-white/[0.10] bg-white/[0.05]">
              <tr>
                {["優先度", "ティッカー", "NISA推奨理由"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left font-mono text-[9px] uppercase tracking-widest text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { priority: "1st", ticker: "VOO", reason: "最大配分50%×最大期待リターン。NISA非課税効果が最も大きい" },
                { priority: "2nd", ticker: "QQQ", reason: "高成長×高税負担になりやすい。NISA枠が残れば優先" },
                { priority: "3rd", ticker: "VEA", reason: "中程度のリターン。NISA枠次第" },
                { priority: "課税口座", ticker: "VWO", reason: "成長不確実性高い。NISA枠はリターン確実性が高いものへ優先配分" },
              ].map((r) => (
                <tr key={r.priority} className="border-t border-white/[0.08]">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-400">{r.priority}</td>
                  <td className="px-4 py-2.5 font-mono text-xs font-bold text-[#34d399]">{r.ticker}</td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 font-mono text-[9px] text-slate-700">
          新NISA年間上限: 360万（成長投資枠240万+積立投資枠120万）。
          NISA枠超過分は課税口座へ。VWOは新興国不確実性があるためNISA枠は確実性の高いVOO・QQQを優先。
        </p>
      </section>

      {/* 検証との接続 */}
      <div className="rounded-2xl border border-white/[0.10] bg-white/[0.04] px-5 py-4">
        <p className="font-mono text-[10px] uppercase tracking-widest text-slate-500 mb-2">このサイトのロジックとの接続</p>
        <p className="text-xs leading-6 text-slate-400">
          phi2シグナルが発動したとき、<strong className="text-slate-300">VOO（S&P500）と VEA（先進国）を同時に買う</strong>のが統計的に支持される行動。
          QQQ・VWO・日本株は phi2 シグナルに連動させず、毎月の積立（DCA）で淡々と保有する。
          シグナルを使う枠とDCA枠を分けて管理するのがこの構成の核心。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href="/signal"
            className="rounded-xl border border-[#34d399]/30 bg-[#34d399]/[0.08] px-3 py-1.5 font-mono text-[10px] text-[#34d399] hover:bg-[#34d399]/[0.14] transition-colors"
          >
            → 今日のシグナルを確認
          </Link>
          <Link
            href="/learn"
            className="rounded-xl border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 font-mono text-[10px] text-slate-400 hover:bg-white/[0.08] transition-colors"
          >
            → バックテスト結果を読む
          </Link>
        </div>
      </div>

    </div>
  );
}
