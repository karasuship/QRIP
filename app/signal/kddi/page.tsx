import type { Metadata } from "next";
import JpStockPage from "@/app/signal/_jp/StockPage";

export const metadata: Metadata = {
  title: "QRIP — KDDI シグナル",
  description: "KDDI（9433）の配当利回りシグナル。割安・中立・割高の判定と根拠を表示。",
};

export const revalidate = 900;

export default function KddiPage() {
  return <JpStockPage code="9433" />;
}
