import type { Metadata } from "next";
import { fetchSignal } from "@/lib/signal";
import EtfSignalPage from "@/app/signal/_global/EtfSignalPage";

export const metadata: Metadata = {
  title: "QRIP — EEM 新興国 ETF シグナル",
  description: "EEM（新興国インデックス ETF）の phi2 シグナル状態。CRS は SP500 と共用。Round 42 グローバル検証。",
};

export const revalidate = 900;

export default async function EemPage() {
  const signal = await fetchSignal();
  return (
    <EtfSignalPage
      config={{
        ticker: "EEM",
        displayName: "新興国 ETF (EEM)",
        tvSymbol: "NASDAQ:EEM",
        getAthDd: (s) => s.eemAthDd,
        getActive: (s) => s.eemActive,
        testZ: null,
        testNote: "新興国市場への分散。EFA より高リスク・高リターン特性。",
        researchRound: "Round 42",
        description:
          "EEM（iShares MSCI Emerging Markets ETF）は中国・韓国・台湾・インドなど新興国を対象とした ETF。" +
          "Round 42 のグローバルシグナル検証の一部として採用。" +
          "EFA（TEST Z=+8.08）ほどの明確な数値は確認できていないが、SP500 の phi2 条件は新興国市場の危機回復にも一定の有効性を示す。" +
          "新興国固有リスク（政治・通貨・流動性）があるため、EFA よりも投入比率を抑えた使い方が現実的。" +
          "CRS は SP500 ベース。米国危機がグローバルに波及するパターンで有効。",
      }}
      signal={signal}
    />
  );
}
