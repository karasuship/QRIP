import type { Metadata } from "next";
import { fetchSignal } from "@/lib/signal";
import EtfSignalPage from "@/app/signal/_global/EtfSignalPage";

export const metadata: Metadata = {
  title: "QRIP — VT オルカン（全世界株）シグナル",
  description: "VT（全世界株 ETF）の phi2 シグナル状態。SP500 phi2 に連動。合成オルカン（1996-2026）TEST Z=+7.21。",
};

export const revalidate = 900;

export default async function VtPage() {
  const signal = await fetchSignal();
  return (
    <EtfSignalPage
      config={{
        ticker: "VT",
        displayName: "全世界株 ETF / オルカン (VT)",
        tvSymbol: "AMEX:VT",
        getAthDd: (s) => s.vtAthDd,
        getActive: (s) => s.vtActive,
        testZ: "7.21",
        testNote: "合成オルカン（SP500×65%+EFA×25%+EEM×10%）の 30 年バックテスト結果。VT 直接の統計は不十分のため参考値。",
        researchRound: "Round 49",
        linkedTo: "※ シグナルは SP500 phi2 と完全連動（VT 独立シグナルは設けていない）",
        description:
          "VT（Vanguard Total World Stock ETF）は全世界株式を対象とした ETF（オルカン相当）。" +
          "VT の上場は 2008 年 6 月で、TRAIN/TEST に使えるデータが約 18 年と短く、VT 直接の検証では TRAIN Z=-3.16 と失敗した。" +
          "Round 49 では合成オルカン（SP500×65% + EFA×25% + EEM×10% / MSCI ACWI 近似）で 30 年検証を実施。" +
          "TRAIN Z=+6.49、TEST Z=+7.21（DCA比 +13.9%）と高品質を確認（decisions/0036）。" +
          "グローバル金融危機は米国 CRS が検知し、世界株は同時に底を打つ構造であることを Round 42 で確認済み。" +
          "「SP500 phi2 発動 → SP500 + オルカン（VT/eMAXIS Slim 全世界）の同時買い」は統計的に支持される。",
      }}
      signal={signal}
    />
  );
}
