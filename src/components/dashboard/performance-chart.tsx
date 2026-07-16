'use client'

/**
 * PerformanceChart — the dashboard's main analytics chart (plan §2C).
 *
 * One chart, four metric tabs: انتشارها | تعامل | دسترسی | رشد مخاطبان
 * Controls: compare-with-previous-period toggle.
 * Responds to the global range/platform filters (URL-driven).
 * Persian tooltip with Jalali dates. All states via ChartPanel.
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, Send, Heart, Eye, Users, GitCompareArrows } from 'lucide-react'
import { api } from '@/lib/api'
import { toPersianDigits, formatCompact, formatJalaliShort } from '@/lib/jalali'
import { useDashboardFilters, rangeDays } from '@/lib/dashboard-filters'
import { useShouldAnimate } from '@/lib/motion'
import { AnimatedTabs } from './shared'
import { ChartPanel } from './chart-panel'
import { ChartTooltip } from './chart-tooltip'
import { Toggle } from '@/components/ui/toggle'

interface SeriesResult {
  dates: string[]
  reach: number[]
  engagement: number[]
  followers: number[]
  clicks: number[]
  publications: number[]
}

type MetricTab = 'publications' | 'engagement' | 'reach' | 'audience'

const TABS = [
  { value: 'publications' as const, label: 'انتشارها', icon: Send },
  { value: 'engagement' as const, label: 'تعامل', icon: Heart },
  { value: 'reach' as const, label: 'دسترسی', icon: Eye },
  { value: 'audience' as const, label: 'رشد مخاطبان', icon: Users },
]

const SERIES_KEY: Record<MetricTab, keyof Omit<SeriesResult, 'dates'>> = {
  publications: 'publications',
  engagement: 'engagement',
  reach: 'reach',
  audience: 'followers',
}

export function PerformanceChart() {
  const { range, platform } = useDashboardFilters()
  const [tab, setTab] = useState<MetricTab>('publications')
  const [compare, setCompare] = useState(false)
  const animateChart = useShouldAnimate()

  const { data, isLoading, isError, refetch, dataUpdatedAt } = useQuery<SeriesResult>({
    queryKey: ['dashboard-performance', range, platform, compare],
    queryFn: () =>
      api.get<SeriesResult>(
        `/api/analytics?range=${range}&platform=${platform}${compare ? '&compare=1' : ''}`
      ),
    refetchInterval: 120000,
    refetchIntervalInBackground: false,
    placeholderData: (prev) => prev,
  })

  const days = rangeDays(range)

  // Build chart rows. With compare on, the API returns a 2× window: the last
  // `days` entries are the current period; earlier entries overlay as `prev`.
  const rows = useMemo(() => {
    if (!data) return []
    const values = data[SERIES_KEY[tab]] ?? []
    const points = data.dates.map((date, i) => ({ date, value: values[i] ?? 0 }))
    const current = points.slice(-days)
    if (!compare) {
      return current.map((p) => ({
        label: formatJalaliShort(new Date(p.date)),
        value: p.value,
      }))
    }
    const previous = points.slice(0, Math.max(points.length - days, 0)).slice(-days)
    return current.map((p, i) => ({
      label: formatJalaliShort(new Date(p.date)),
      value: p.value,
      prev: previous[i]?.value ?? null,
    }))
  }, [data, tab, days, compare])

  const activeLabel = TABS.find((t) => t.value === tab)?.label ?? ''

  return (
    <ChartPanel
      title="نمای عملکرد"
      subtitle="روند شاخص‌های اصلی"
      icon={TrendingUp}
      period={range === '90d' ? '۹۰ روز' : range === '30d' ? '۳۰ روز' : '۷ روز'}
      loading={isLoading && !data}
      error={isError}
      onRetry={() => refetch()}
      insufficientData={!isLoading && !isError && rows.length < 3}
      lastUpdated={dataUpdatedAt ? new Date(dataUpdatedAt) : undefined}
      skeletonHeight="h-[260px] sm:h-[300px]"
      headerSlot={
        <Toggle
          size="sm"
          pressed={compare}
          onPressedChange={setCompare}
          aria-label="مقایسه با دوره قبل"
          className="gap-1 text-xs min-h-[44px] sm:min-h-0"
        >
          <GitCompareArrows className="size-3.5" />
          <span className="hidden md:inline">دوره قبل</span>
        </Toggle>
      }
    >
      <AnimatedTabs value={tab} onValueChange={setTab} tabs={TABS} size="sm" className="mb-3" />

      <div className="h-[220px] sm:h-[260px] w-full" data-visual-mask="performance-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)', fontFamily: 'inherit' }}
              tickFormatter={(v) => toPersianDigits(String(v))}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)', fontFamily: 'inherit' }}
              tickFormatter={(v) => formatCompact(Number(v))}
              axisLine={false}
              tickLine={false}
              width={44}
              orientation="right"
            />
            <Tooltip
              content={
                <ChartTooltip
                  labelMap={{ value: activeLabel, prev: 'دوره قبل' }}
                  formatValue={(v) => toPersianDigits(formatCompact(v))}
                />
              }
            />
            {compare && (
              <Area
                type="monotone"
                dataKey="prev"
                stroke="var(--color-ink-tertiary)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="none"
                isAnimationActive={animateChart}
                animationDuration={300}
                connectNulls
              />
            )}
            {/* Draw animation on tab/filter change (plan §12: tab transitions
                are allowed motion); disabled under prefers-reduced-motion. */}
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-accent)"
              strokeWidth={2}
              fill="url(#perfGrad)"
              isAnimationActive={animateChart}
              animationDuration={350}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accessible summary (plan §13: خلاصه قابل‌دسترسی برای نمودار) */}
      <span className="sr-only">
        {rows.length > 0 &&
          `نمودار ${activeLabel} برای ${toPersianDigits(rows.length)} روز؛ آخرین مقدار ${toPersianDigits(
            formatCompact(rows[rows.length - 1]?.value ?? 0)
          )}`}
      </span>
    </ChartPanel>
  )
}
