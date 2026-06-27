import type { Metadata } from "next";
import { fetchSignal } from "@/lib/signal";
import EtfSignalPage from "@/app/signal/_global/EtfSignalPage";

export const metadata: Metadata = {
  title: "QRIP — EFA 先進国 ETF シグナル",
  description: "EFA（先進国インデックス ETF）の phi2 シグナル状態。CRS は SP500 と共用。Round 42 TEST Z=+8.08。",
};

export const revalidate = 900;

export default async function EfaPage() {
  const signal = await fetchSignal();
  return (
    <EtfSignalPage
      config={{
        ticker: "EFA",
        displayName: "先進国 ETF (EFA)",
        tvSymbol: "NASDAQ:EFA",
        getAthDd: (s) => s.efaAthDd,
        getActive: (s) => s.efaActive,
        testZ: "8.08",
        testNote: "SP500 と同等品質。分散の観点からも統計的に支持される同時買い。",
        researchRound: "Round 42",
        description:
          "EFA（iShares MSCI EAFE ETF）は日本・欧州・豪州など先進国（米国除く）を対象としたインデックス ETF。" +
          "Round 42 では 1993-2024 の 30 年バックテストで、SP500 の phi2 v3 条件を EFA にそのまま適用した場合の成績���検証。" +
          "TEST Z=+8.08���DCA比 +15.6%）と SP500 の TEST Z=+8.65 とほぼ同等の品質を確認。" +
          "CRS は米国指標（VIX/HYG/DXY/RSP）ベースだが、グローバルな金融危機を正しく検知できることを確認。" +
          "phi2 発動時に SP500 + EFA の同時買いが統計的に支持される（R42）。",
      }}
      signal={signal}
    />
  );
}
