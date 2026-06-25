"use client";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type Sp500SignalChartType from "./Sp500SignalChart";

const Sp500SignalChart = dynamic(() => import("./Sp500SignalChart"), { ssr: false });

export default function Sp500SignalChartClient(
  props: ComponentProps<typeof Sp500SignalChartType>
) {
  return <Sp500SignalChart {...props} />;
}
