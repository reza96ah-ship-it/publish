'use client'

import { useMemo, useState } from 'react'
import { useQuery, useQueries } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BarChart3,
  TrendingUp,
  Eye,
  Users,
  MousePointerClick,
  Heart,
  Activity,
  FileText,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'

import { api } from '@/lib/api'
import {
  toPersianDigits,
  formatCompact,
  formatJalaliShort,
  formatJalali,
  formatJalaliTime,
} from '@/lib/jalali'
import {
  SectionTitle,
  PlatformIcon,
  StatusBadge,
  EmptyState,
  Skeleton,
  LoadingState,
  AnimatedTabs,
  KpiCard,
} from '@/components/dashboard/shared'
import { ChartTooltip, BarChartTooltip } from '@/components/dashboard/chart-tooltip'
import { announce } from '@/lib/aria-live'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface AnalyticsData {
  dates: string[]
  reach: number[]
  engagement: number[]
  followers: number[]
  clicks: number[]
}

interface PublishJob {
  id: string
  title: string
  thumbnail: string
  platform: string
  platformName: string
  status: string
  statusLabel: string
  progress: number
  scheduledAt: string | null
  completedAt: string | null
  error: string | null
  retryCount: number
  assignee: string
  assigneeAvatar: string
  campaign: string
}

const PLATFORMS = [
  { id: 'instagram', label: 'اینستاگرام', color: '#ec4899' },
  { id: 'telegram', label: 'تلگرام', color: '#0ea5e9' },
  { id: 'linkedin', label: 'لینکدین', color: '#2563eb' },
  { id: 'rubika', label: 'روبیکا', color: '#a855f7' },
]

export function AnalyticsView() {
  const [period, setPeriod] = useState<'7' | '30'>('7')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['analytics', 'all'],
    queryFn: () => api.get<AnalyticsData>('/api/analytics?platform=all'),
  })

  const { data: publishJobs } = useQuery<PublishJob[]>({
    queryKey: ['publish-jobs'],
    queryFn: () => api.getPaginated<PublishJob>('/api/publish-jobs'),
  })

  // Per-platform analytics (parallel)
  const platformQueries = useQueries({
    queries: PLATFORMS.map((p) => ({
      queryKey: ['analytics', p.id],
      queryFn: () => api.get<AnalyticsData>(`/api/analytics?platform=${p.id}`),
      staleTime: 60_000,
    })),
  })

  const chartData = useMemo(() => {
    if (!data) return []
    return data.dates.map((d, i) => ({
      date: formatJalaliShort(new Date(d)),
      reach: data.reach[i] ?? 0,
      engagement: data.engagement[i] ?? 0,
      followers: data.followers[i] ?? 0,
      clicks: data.clicks[i] ?? 0,
    }))
  }, [data])

  const periodSlice = useMemo(() => {
    if (period === '7') return chartData.slice(-7)
    return chartData
  }, [chartData, period])

  const kpis = useMemo(() => {
    if (!data || data.dates.length === 0) {
      return { reach: 0, engagement: 0, followers: 0, clicks: 0 }
    }
    const last = data.dates.length - 1
    return {
      reach: data.reach[last] ?? 0,
      engagement: data.engagement[last] ?? 0,
      followers: data.followers[last] ?? 0,
      clicks: data.clicks[last] ?? 0,
    }
  }, [data])

  // KPI card dataset — each card carries its own sliced series, trend,
  // previous-period value, and date labeler for the interactive chart tooltip.
  const kpiCards = useMemo(() => {
    const slice = <T,>(arr: T[] | undefined): T[] => (arr ?? []).slice(period === '7' ? -7 : -30)
    const reach = slice(data?.reach)
    const engagement = slice(data?.engagement)
    const followers = slice(data?.followers)
    const clicks = slice(data?.clicks)
    const dates = slice(data?.dates)
    const trend = (arr: number[]) =>
      arr.length >= 2 && arr[0] > 0 ? ((arr[arr.length - 1] - arr[0]) / arr[0]) * 100 : 0
    const prev = (arr: number[]) => (arr.length >= 2 ? arr[0] : undefined)
    const labelFor = (i: number) => (dates[i] ? formatJalaliShort(new Date(dates[i])) : '')
    return [
      {
        key: 'reach',
        label: 'دسترسی',
        value: kpis.reach,
        icon: Eye,
        iconColor: 'text-violet-600',
        sparkColor: 'var(--color-accent)',
        spark: reach,
        trend: trend(reach),
        prev: prev(reach),
        labelFor,
      },
      {
        key: 'engagement',
        label: 'تعامل',
        value: kpis.engagement,
        icon: Heart,
        iconColor: 'text-pink-600',
        sparkColor: '#ec4899',
        spark: engagement,
        trend: trend(engagement),
        prev: prev(engagement),
        labelFor,
      },
      {
        key: 'followers',
        label: 'رشد مخاطبان',
        value: kpis.followers,
        icon: Users,
        iconColor: 'text-emerald-600',
        sparkColor: '#10b981',
        spark: followers,
        trend: trend(followers),
        prev: prev(followers),
        labelFor,
      },
      {
        key: 'clicks',
        label: 'کلیک',
        value: kpis.clicks,
        icon: MousePointerClick,
        iconColor: 'text-amber-600',
        sparkColor: '#f59e0b',
        spark: clicks,
        trend: trend(clicks),
        prev: prev(clicks),
        labelFor,
      },
    ]
  }, [data, kpis, period])

  const filteredJobs = useMemo(() => {
    if (!publishJobs) return []
    if (statusFilter === 'all') return publishJobs
    return publishJobs.filter((j) => j.status === statusFilter)
  }, [publishJobs, statusFilter])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="space-y-5"
    >
      <SectionTitle
        icon={BarChart3}
        badge={
          <AnimatedTabs
            value={period}
            onValueChange={(v) => {
              setPeriod(v as '7' | '30')
              announce(`${v === '7' ? '۷' : '۳۰'} روز انتخاب شد`)
            }}
            tabs={[
              { value: '7', label: '۷ روز' },
              { value: '30', label: '۳۰ روز' },
            ]}
          />
        }
      >
        تحلیل و گزارش‌ها
      </SectionTitle>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((k) => (
          <KpiCard
            key={k.key}
            label={k.label}
            value={k.value}
            icon={k.icon}
            iconColor={k.iconColor}
            sparkColor={k.sparkColor}
            spark={k.spark}
            trend={k.trend}
            previousValue={k.prev}
            formatSparkLabel={k.labelFor}
            loading={isLoading}
            timeLabel={period === '7' ? '۷ روز پیش' : '۳۰ روز پیش'}
          />
        ))}
      </div>

      {/* Reach area chart */}
      <div className="n-card n-gradient-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-accent" />
            <h2 className="text-sm font-[600] text-ink-primary">روند دسترسی</h2>
          </div>
          <span className="text-[11px] text-ink-tertiary num-tabular">
            {toPersianDigits(periodSlice.length)} روز
          </span>
        </div>
        <LoadingState
          isLoading={isLoading}
          skeleton={<Skeleton className="h-64 w-full rounded-xl" />}
        >
          <div dir="ltr" className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={periodSlice} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="reachGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-accent)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--color-accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)' }}
                  tickFormatter={(v) => toPersianDigits(v)}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)' }}
                  tickFormatter={(v) => formatCompact(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="reach"
                  stroke="var(--color-accent)"
                  strokeWidth={2.5}
                  fill="url(#reachGrad)"
                  name="دسترسی"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </LoadingState>
      </div>

      {/* Platform breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="n-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="size-4 text-accent" />
            <h2 className="text-sm font-[600] text-ink-primary">دسترسی به تفکیک پلتفرم</h2>
          </div>
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={PLATFORMS.map((p, i) => {
                  const pd = platformQueries[i]?.data
                  const total = pd ? pd.reach.reduce((s, v) => s + v, 0) : 0
                  return { name: p.label, value: total, fill: p.color }
                })}
                margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: 'var(--color-ink-tertiary)' }}
                  tickFormatter={(v) => formatCompact(Number(v))}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip content={<BarChartTooltip />} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {PLATFORMS.map((p, i) => {
              const pd = platformQueries[i]?.data
              const total = pd ? pd.reach.reduce((s, v) => s + v, 0) : 0
              return (
                <div key={p.id} className="flex items-center gap-2 text-[11px]">
                  <PlatformIcon platform={p.id} className="size-5" />
                  <span className="text-ink-secondary">{p.label}</span>
                  <span className="ms-auto font-[700] text-ink-primary num-tabular">
                    {toPersianDigits(formatCompact(total))}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Top metrics summary */}
        <div className="n-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="size-4 text-accent" />
            <h2 className="text-sm font-[600] text-ink-primary">خلاصه عملکرد</h2>
          </div>
          <div className="space-y-3">
            {[
              {
                label: 'میانگین نرخ تعامل',
                value: `${toPersianDigits(4.8)}٪`,
                trend: `+${toPersianDigits(0.6)}٪`,
              },
              {
                label: 'میانگین دسترسی روزانه',
                value: toPersianDigits(formatCompact(kpis.reach)),
                trend: `+${toPersianDigits(12)}٪`,
              },
              {
                label: 'رشد فالوور (۳۰ روز)',
                value: toPersianDigits(
                  formatCompact(data?.followers.reduce((s, v) => s + v, 0) ?? 0)
                ),
                trend: `+${toPersianDigits(8)}٪`,
              },
              {
                label: 'کل کلیک‌ها',
                value: toPersianDigits(formatCompact(data?.clicks.reduce((s, v) => s + v, 0) ?? 0)),
                trend: `+${toPersianDigits(3)}٪`,
              },
            ].map((row) => (
              <div key={row.label} className="n-card-compact flex items-center justify-between p-3">
                <span className="text-[12px] text-ink-secondary">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-[700] text-ink-primary num-tabular">
                    {row.value}
                  </span>
                  <span className="text-[10px] font-[700] text-success bg-success-soft rounded-full px-1.5 py-0.5">
                    {row.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logs section */}
      <div className="n-card p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-accent" />
            <h2 className="text-sm font-[600] text-ink-primary">گزارش‌ها و لاگ‌ها</h2>
            <span className="text-[10px] text-ink-tertiary num-tabular">
              {toPersianDigits(filteredJobs.length)} رکورد
            </span>
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue placeholder="همه" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="success">منتشر شد</SelectItem>
              <SelectItem value="failed">ناموفق</SelectItem>
              <SelectItem value="scheduled">برنامه‌ریزی‌شده</SelectItem>
              <SelectItem value="pending">در انتظار</SelectItem>
              <SelectItem value="processing">در حال پردازش</SelectItem>
              <SelectItem value="action">نیازمند اقدام</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto thin-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                  عنوان
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                  پلتفرم
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                  وضعیت
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700] hidden sm:table-cell">
                  زمان انتشار
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700] hidden md:table-cell">
                  تکمیل
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700] hidden md:table-cell">
                  تلاش مجدد
                </TableHead>
                <TableHead className="text-right text-[11px] text-ink-tertiary font-[700] hidden lg:table-cell">
                  خطا
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredJobs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <EmptyState
                      icon={FileText}
                      title="رکوردی یافت نشد"
                      message="در این فیلتر گزارشی وجود ندارد."
                      illustration="search"
                      size="compact"
                      action={
                        <Button size="sm" variant="outline" onClick={() => setStatusFilter('all')}>
                          نمایش همه وضعیت‌ها
                        </Button>
                      }
                    />
                  </TableCell>
                </TableRow>
              ) : (
                filteredJobs.slice(0, 30).map((j) => (
                  <TableRow key={j.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {j.thumbnail ? (
                          <img
                            src={j.thumbnail}
                            alt=""
                            className="size-8 rounded-lg object-cover shrink-0"
                          />
                        ) : (
                          <div className="size-8 rounded-lg bg-border flex items-center justify-center shrink-0">
                            <PlatformIcon platform={j.platform} className="size-4" />
                          </div>
                        )}
                        <span className="text-[12px] font-[600] text-ink-primary truncate max-w-40">
                          {j.title}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <PlatformIcon platform={j.platform} className="size-4" />
                        <span className="text-[11px] text-ink-secondary hidden sm:inline">
                          {j.platformName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        label={j.statusLabel}
                        variant={
                          j.status === 'success'
                            ? 'published'
                            : j.status === 'failed'
                              ? 'high'
                              : j.status === 'action'
                                ? 'review'
                                : 'scheduled'
                        }
                      />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-[11px] text-ink-secondary">
                      {j.scheduledAt
                        ? `${formatJalali(new Date(j.scheduledAt))} ${formatJalaliTime(new Date(j.scheduledAt))}`
                        : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] text-ink-secondary">
                      {j.completedAt ? formatJalaliTime(new Date(j.completedAt)) : '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[11px] num-tabular">
                      {j.retryCount > 0 ? (
                        <span
                          className={cn(
                            'font-[700]',
                            j.retryCount > 2 ? 'text-danger' : 'text-warning'
                          )}
                        >
                          {toPersianDigits(j.retryCount)}
                        </span>
                      ) : (
                        <span className="text-ink-tertiary">۰</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-[11px] text-danger max-w-48 truncate">
                      {j.error ?? '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </motion.div>
  )
}
