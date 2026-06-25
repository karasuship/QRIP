"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type CrsHistoryChartType from "./CrsHistoryChart";

const CrsHistoryChart = dynamic(() => import("./CrsHistoryChart"), { ssr: false });

export default function CrsHistoryChartClient(
  props: ComponentProps<typeof CrsHistoryChartType>
) {
  return <CrsHistoryChart {...props} />;
}
