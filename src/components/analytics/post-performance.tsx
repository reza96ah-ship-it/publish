'use client'

/**
 * Issue #215: per-post performance drill-down + campaign ROI rollup.
 * Table of published posts with their latest collected metrics; clicking a
 * row opens a sheet with the metric timeline. Providers without a per-post
 * insights API get an honest "not available" note instead of fake numbers.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BarChart3, RefreshCw, Trophy } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

import { api } from '@/lib/api'
import { formatCompact, formatJalali, toPersianDigits } from '@/lib/jalali'
import { POST_METRIC_LABELS, type PostMetricType } from '@/modules/analytics/post-metrics-shared'
import { PlatformIcon, EmptyState } from '@/components/dashboard/shared'
import { ChartTooltip } from '@/components/dashboard/chart-tooltip'
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface PerPostItem {
  id: string
  title: string
  platform: string
  platformName: string
  publishedAt: string | null
  campaign: string | null
  metrics: Partial<Record<PostMetricType, number>>
  metricsSupported: boolean
}

interface CampaignRollup {
  name: string
  count: number
  reach: number
  engagement: number
  topPosts: { id: string; title: string; reach: number }[]
}

interface PerPostResponse {
  posts: PerPostItem[]
  campaigns: CampaignRollup[]
  total: number
}

interface PostDetail {
  id: string
  title: string
  platform: string
  platformName: string
  campaign: string | null
  publishedAt: string | null
  support: { metrics: PostMetricType[]; note: string }
  timeline: { dates: string[]; series: Partial<Record<PostMetricType, number[]>> }
}

const METRIC_COLORS: Record<PostMetricType, string> = {
  reach: 'var(--color-accent)',
  likes: 'var(--color-platform-instagram)',
  comments: 'var(--color-success)',
  saved: 'var(--color-warning)',
}

function MetricCell({ value, supported }: { value: number | undefined; supported: boolean }) {
  if (!supported) return <span className="text-ink-tertiary">—</span>
  if (value === undefined) return <span className="text-ink-tertiary">در انتظار جمع‌آوری</span>
  return <span className="num-tabular font-semibold">{formatCompact(value)}</span>
}

function PostDetailSheet({
  publicationId,
  onClose,
}: {
  publicationId: string | null
  onClose: () => void
}) {
  const { data, isLoading } = useQuery<PostDetail>({
    queryKey: ['per-post-detail', publicationId],
    queryFn: () => api.get<PostDetail>(`/api/analytics/per-post/${publicationId}`),
    enabled: !!publicationId,
  })

  const chartData =
    data?.timeline.dates.map((d, i) => {
      const row: Record<string, string | number> = {
        date: formatJalali(new Date(d)),
      }
      for (const [metric, values] of Object.entries(data.timeline.series)) {
        row[metric] = values?.[i] ?? 0
      }
      return row
    }) ?? []
  const activeMetrics = Object.keys(data?.timeline.series ?? {}) as PostMetricType[]

  return (
    <Sheet open={!!publicationId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-start">{data?.title ?? 'جزئیات پست'}</SheetTitle>
          <SheetDescription className="text-start">
            {data && (
              <span className="inline-flex items-center gap-2">
                <PlatformIcon platform={data.platform} className="size-4" />
                {data.platformName}
                {data.campaign && <span>· کمپین {data.campaign}</span>}
                {data.publishedAt && <span>· {formatJalali(new Date(data.publishedAt))}</span>}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-ink-tertiary">در حال بارگذاری...</p>
        ) : !data ? null : data.support.metrics.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={BarChart3}
              title="آمار این سرویس در دسترس نیست"
              message={data.support.note}
              illustration="analytics"
              size="compact"
            />
          </div>
        ) : chartData.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={BarChart3}
              title="هنوز داده‌ای جمع‌آوری نشده"
              message="با دکمه «به‌روزرسانی آمار» داده‌های این پست را از سرویس دریافت کنید."
              illustration="analytics"
              size="compact"
            />
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="h-[220px] sm:h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 'var(--chart-font-size)' }} reversed />
                  <YAxis
                    tick={{ fontSize: 'var(--chart-font-size)' }}
                    orientation="right"
                    tickFormatter={(v) => formatCompact(Number(v))}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  {activeMetrics.map((metric) => (
                    <Area
                      key={metric}
                      type="monotone"
                      dataKey={metric}
                      name={POST_METRIC_LABELS[metric]}
                      stroke={METRIC_COLORS[metric]}
                      fill={METRIC_COLORS[metric]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-2xs text-ink-tertiary">{data.support.note}</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

export function PostPerformanceSection() {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data, isLoading } = useQuery<PerPostResponse>({
    queryKey: ['per-post'],
    queryFn: () => api.get<PerPostResponse>('/api/analytics/per-post'),
  })

  const collectMutation = useMutation({
    mutationFn: () =>
      api.post<{ collected: number; skipped: number; errors: number }>(
        '/api/analytics/per-post/collect',
        {}
      ),
    onSuccess: (res) => {
      if (res.collected > 0) {
        toast.success(`آمار ${toPersianDigits(res.collected)} پست به‌روزرسانی شد`)
      } else {
        toast.info('پستی با قابلیت جمع‌آوری آمار پیدا نشد')
      }
      queryClient.invalidateQueries({ queryKey: ['per-post'] })
      queryClient.invalidateQueries({ queryKey: ['per-post-detail'] })
    },
    onError: (err: Error) => toast.error(err.message || 'خطا در جمع‌آوری آمار'),
  })

  const posts = data?.posts ?? []
  const campaigns = (data?.campaigns ?? []).filter((c) => c.name !== 'بدون کمپین')

  return (
    <div className="space-y-4">
      {/* Campaign ROI rollup */}
      {campaigns.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {campaigns.slice(0, 3).map((c) => (
            <div key={c.name} className="n-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="size-4 text-warning" />
                <p className="text-base font-semibold text-ink-primary truncate">{c.name}</p>
              </div>
              <div className="flex items-center gap-4 text-xs text-ink-secondary num-tabular">
                <span>{toPersianDigits(c.count)} پست</span>
                <span>دسترسی {formatCompact(c.reach)}</span>
                <span>تعامل {formatCompact(c.engagement)}</span>
              </div>
              {c.topPosts[0] && c.topPosts[0].reach > 0 && (
                <button
                  onClick={() => setSelectedId(c.topPosts[0].id)}
                  className="n-focus-ring mt-2 text-2xs text-accent text-start truncate w-full min-h-[44px] md:min-h-0"
                >
                  برترین پست: {c.topPosts[0].title}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Per-post table */}
      <div className="n-card p-0 overflow-hidden">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink-primary">عملکرد پست‌ها</h2>
            <span className="text-2xs text-ink-tertiary num-tabular">
              {toPersianDigits(posts.length)} پست منتشرشده
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => collectMutation.mutate()}
            disabled={collectMutation.isPending}
          >
            <RefreshCw className={collectMutation.isPending ? 'size-3.5 animate-spin' : 'size-3.5'} />
            به‌روزرسانی آمار
          </Button>
        </div>
        <div className="overflow-x-auto thin-scrollbar">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-start text-xs text-ink-tertiary font-bold">عنوان</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold">پلتفرم</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">کمپین</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden md:table-cell">انتشار</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold">دسترسی</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">پسند</TableHead>
                <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden md:table-cell">دیدگاه</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-sm text-ink-tertiary">
                    در حال بارگذاری...
                  </TableCell>
                </TableRow>
              ) : posts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10">
                    <EmptyState
                      icon={BarChart3}
                      title="هنوز پستی منتشر نشده"
                      message="پس از انتشار اولین پست، عملکرد آن اینجا نمایش داده می‌شود."
                      illustration="analytics"
                      size="compact"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                posts.slice(0, 20).map((p) => (
                  <TableRow
                    key={p.id}
                    className="border-border cursor-pointer"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <TableCell className="max-w-48">
                      <span className="text-sm text-ink-primary truncate block">{p.title}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
                        <PlatformIcon platform={p.platform} className="size-4" />
                        <span className="hidden lg:inline">{p.platformName}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-ink-secondary">
                      {p.campaign ?? '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs text-ink-tertiary num-tabular">
                      {p.publishedAt ? formatJalali(new Date(p.publishedAt)) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      <MetricCell value={p.metrics.reach} supported={p.metricsSupported} />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs">
                      <MetricCell value={p.metrics.likes} supported={p.metricsSupported} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs">
                      <MetricCell value={p.metrics.comments} supported={p.metricsSupported} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PostDetailSheet publicationId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  )
}
