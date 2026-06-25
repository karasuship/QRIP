"use client";
// Next.js 16 Turbopack: ssr:false は Client Component 内でのみ使える
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type SimulationChartType from "./SimulationChart";

const SimulationChart = dynamic(() => import("./SimulationChart"), { ssr: false });

export default function SimulationChartClient(
  props: ComponentProps<typeof SimulationChartType>
) {
  return <SimulationChart {...props} />;
}
