import type { Metadata } from "next";
import CompareClient from "./CompareClient";

export const metadata: Metadata = {
  title: "戦略比較 — 期待値・リスク・総合スコアを時間軸別に比較",
  description:
    "VOO積立・QQQ積立・phi2シグナル活用・Mag7集中の4戦略を10年・20年・30年でモンテカルロ比較。期待値とリスクのバランスを総合スコアで可視化。",
};

export default function ComparePage() {
  return <CompareClient />;
}
