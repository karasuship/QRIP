import type { Metadata } from "next";
import JpStockPage from "@/app/signal/_jp/StockPage";

export const metadata: Metadata = {
  title: "QRIP — NTT シグナル",
  description: "NTT（9432）の配当利回りシグナル。割安・中立・割高の判定と根拠を表示。",
};

export const revalidate = 900;

export default function NttPage() {
  return <JpStockPage code="9432" />;
}
