import type { Metadata } from "next";
import { fetchSignal } from "@/lib/signal";
import EtfSignalPage from "@/app/signal/_global/EtfSignalPage";

export const metadata: Metadata = {
  title: "QRIP — QQQ ナスダック100 シグナル",
  description: "QQQ（ナスダック100 ETF）の phi2 シグナル状態。ATH-18% 閾値。Round 48 TEST Z=+6.77。弱シグナル扱い。",
};

export const revalidate = 900;

export default async function QqqPage() {
  const signal = await fetchSignal();
  return (
    <EtfSignalPage
      config={{
        ticker: "QQQ",
        displayName: "ナスダック100 ETF (QQQ)",
        tvSymbol: "NASDAQ:QQQ",
        getAthDd: (s) => s.qqqAthDd,
        getActive: (s) => s.qqqActive,
        testZ: "6.77",
        testNote: "弱シグナル扱い（n=20）。SP500 phi2 同時発動時の補助確認として使用。",
        researchRound: "Round 48",
        athThrLabel: "ATH-18%",
        qualityNote: "弱シグナル: TRAIN Z=+3.19（SP500 の +4.91 に劣る）。ドットコム崩壊（2000-2002）の L 字型回復が原因。SP500 phi2 と同時発動時に QQQ 追加購入の補助根拠として使用する。",
        description:
          "QQQ（Invesco QQQ Trust）はナスダック100指数に連動する ETF。" +
          "Round 42 で SP500 の phi2 v3 条件をそのまま適用したところ TEST n=58（過発動・希釈）で TEST Z=+3.96 と低品質だった。" +
          "Round 48 でグリッドサーチを実施し、ATH-18% 閾値を採用: TEST n=20、TEST Z=+6.77（TEST +17.8%）。" +
          "TRAIN Z=+3.19 と SP500（+4.91）に劣る原因はドットコム崩壊（2000-2002）の L 字型低迷。" +
          "実用的には「SP500 phi2 発動時に QQQ も同時購入」の補助確認として使えるが、QQQ 単独シグナルとしては弱い（decisions/0036）。",
      }}
      signal={signal}
    />
  );
}
