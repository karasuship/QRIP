import type { Metadata } from "next";
import JpStockPage from "@/app/signal/_jp/StockPage";

export const metadata: Metadata = {
  title: "QRIP — JT シグナル",
  description: "JT（2914）の配当利回りシグナル。割安・中立・割高の判定と根拠を表示。",
};

export const revalidate = 900;

export default function JtPage() {
  return <JpStockPage code="2914" />;
}
