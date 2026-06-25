"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toPersianDigits, formatCompact } from "@/lib/jalali";
import { KpiCard } from "./shared";
import { Users, Eye, Heart, Flag } from "lucide-react";

interface Metric {
  id: string;
  title: string;
  value: number;
  trend: number;
  context: string;
  chartData: number[];
}

export function ExecutiveMetrics() {
  const { data, isLoading } = useQuery<Metric[]>({
    queryKey: ["dashboard-metrics"],
    queryFn: () => api.get<Metric[]>("/api/dashboard/metrics"),
    refetchInterval: 60000,
  });

  const iconFor = (id: string) =>
    id === "engagement" ? Heart : id === "reach" ? Eye : id === "audience" ? Users : Flag;
  const iconColorFor = (id: string) =>
    id === "engagement" ? "text-[#db2777]"
    : id === "reach" ? "text-info"
    : id === "audience" ? "text-accent"
    : "text-success";
  const sparkColorFor = (id: string) =>
    id === "engagement" ? "#db2777"
    : id === "reach" ? "var(--color-info)"
    : id === "audience" ? "var(--color-accent)"
    : "var(--color-success)";
  const fmtFor = (id: string) =>
    id === "campaigns"
      ? (v: number) => toPersianDigits(v.toLocaleString("en-US"))
      : (v: number) => toPersianDigits(formatCompact(v));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {data?.map((m) => {
        const prev =
          m.chartData.length >= 2 ? m.chartData[m.chartData.length - 2] : undefined;
        return (
          <KpiCard
            key={m.id}
            label={m.title}
            value={m.value}
            icon={iconFor(m.id)}
            iconColor={iconColorFor(m.id)}
            sparkColor={sparkColorFor(m.id)}
            spark={m.chartData}
            trend={m.trend}
            previousValue={prev}
            formatValue={fmtFor(m.id)}
            loading={isLoading}
            timeLabel="۷ روز پیش"
          />
        );
      })}
      {isLoading &&
        Array.from({ length: 4 }).map((_, i) => (
          <KpiCard
            key={`skeleton-${i}`}
            label=""
            value={0}
            icon={Eye}
            spark={[]}
            loading
          />
        ))}
    </div>
  );
}
