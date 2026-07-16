'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits, formatCompact } from '@/lib/jalali'
import { useDashboardFilters } from '@/lib/dashboard-filters'
import { trackClient } from '@/lib/track-client'
import { KpiCard, ErrorState } from './shared'
import { Users, Eye, Heart, Flag } from 'lucide-react'

interface Metric {
  id: string
  title: string
  value: number
  trend: number
  context: string
  chartData: number[]
}

/** Where each KPI drills into (plan §2B: click → filtered analytics view). */
const KPI_HREFS: Record<string, string> = {
  engagement: '/analytics?metric=engagement',
  reach: '/analytics?metric=reach',
  audience: '/analytics?metric=followers',
  campaigns: '/campaigns',
}

export function ExecutiveMetrics() {
  const { range, platform } = useDashboardFilters()
  const { data, isLoading, isError, refetch } = useQuery<Metric[]>({
    queryKey: ['dashboard-metrics', range, platform],
    queryFn: () =>
      api.get<Metric[]>(`/api/dashboard/metrics?range=${range}&platform=${platform}`),
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  })

  const iconFor = (id: string) =>
    id === 'engagement' ? Heart : id === 'reach' ? Eye : id === 'audience' ? Users : Flag
  const iconColorFor = (id: string) =>
    id === 'engagement'
      ? 'text-[var(--color-platform-instagram)]'
      : id === 'reach'
        ? 'text-info'
        : id === 'audience'
          ? 'text-accent'
          : 'text-success'
  const sparkColorFor = (id: string) =>
    id === 'engagement'
      ? 'var(--color-platform-instagram)'
      : id === 'reach'
        ? 'var(--color-info)'
        : id === 'audience'
          ? 'var(--color-accent)'
          : 'var(--color-success)'
  const fmtFor = (id: string) =>
    id === 'campaigns'
      ? (v: number) => toPersianDigits(v.toLocaleString('en-US'))
      : (v: number) => toPersianDigits(formatCompact(v))

  const rangeLabel = range === '90d' ? '۹۰ روز پیش' : range === '30d' ? '۳۰ روز پیش' : '۷ روز پیش'

  if (isError) {
    return <ErrorState label="دریافت شاخص‌های عملکرد با مشکل روبه‌رو شد" onRetry={() => refetch()} />
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {data?.map((m) => {
        const prev = m.chartData.length >= 2 ? m.chartData[m.chartData.length - 2] : undefined
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
            timeLabel={rangeLabel}
            href={KPI_HREFS[m.id]}
            onNavigate={() => trackClient('dashboard_kpi_opened', { kpi: m.id })}
          />
        )
      })}
      {isLoading &&
        !data &&
        Array.from({ length: 4 }).map((_, i) => (
          <KpiCard key={`skeleton-${i}`} label="" value={0} icon={Eye} spark={[]} loading />
        ))}
    </div>
  )
}
