'use client'
// ChartPanel — chart standard wrapper (issue #245)
// Every analytics chart must show: title, source, last-updated, and handle
// loading / error / insufficient-data states.
import { type LucideIcon, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatJalaliTime } from '@/lib/jalali'
import type { ReactNode } from 'react'

interface ChartPanelProps {
  title: string
  icon?: LucideIcon
  source?: string          // e.g. "Instagram API"
  lastUpdated?: Date
  period?: string          // e.g. "۷ روز"
  loading?: boolean
  error?: boolean
  onRetry?: () => void
  insufficientData?: boolean   // true when <3 data points
  skeletonHeight?: string      // Tailwind class e.g. "h-48"
  children: ReactNode
  className?: string
  headerSlot?: ReactNode       // extra controls (date picker, filter)
}

export function ChartPanel({
  title,
  icon: Icon = BarChart3,
  source,
  lastUpdated,
  period,
  loading,
  error,
  onRetry,
  insufficientData,
  skeletonHeight = 'h-[200px] sm:h-[240px]',
  children,
  className,
  headerSlot,
}: ChartPanelProps) {
  return (
    <div className={cn('n-card p-5', className)}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="size-4 text-accent shrink-0" />
          <h2 className="text-sm font-semibold text-ink-primary truncate">{title}</h2>
          {period && (
            <span className="text-2xs text-ink-tertiary bg-surface-subtle px-1.5 py-0.5 rounded-full num-tabular shrink-0">
              {period}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerSlot}
          {source && (
            <span className="text-2xs text-ink-tertiary hidden sm:inline">
              منبع: {source}
            </span>
          )}
          {lastUpdated && !loading && (
            <span className="text-2xs text-ink-tertiary num-tabular hidden sm:inline">
              {formatJalaliTime(lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <Skeleton className={cn(skeletonHeight, 'w-full rounded-xl')} />
      ) : error ? (
        <div className={cn('flex flex-col items-center justify-center gap-3 rounded-xl bg-danger-soft text-danger', skeletonHeight)}>
          <AlertCircle className="size-6" />
          <span className="text-sm font-medium">خطا در بارگذاری داده</span>
          {onRetry && (
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
              <RefreshCw className="size-3.5" />
              تلاش دوباره
            </Button>
          )}
        </div>
      ) : insufficientData ? (
        <div className={cn('flex flex-col items-center justify-center gap-2 rounded-xl bg-surface-subtle text-ink-tertiary', skeletonHeight)}>
          <BarChart3 className="size-8 opacity-30" />
          <span className="text-sm font-medium">داده کافی برای نمایش وجود ندارد</span>
          <span className="text-xs text-center max-w-48">
            برای نمایش نمودار حداقل ۳ روز داده نیاز است
          </span>
        </div>
      ) : (
        children
      )}

      {/* Footer: source + last updated on mobile */}
      {(source || lastUpdated) && !loading && !error && !insufficientData && (
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50 sm:hidden">
          {source && <span className="text-2xs text-ink-tertiary">منبع: {source}</span>}
          {lastUpdated && (
            <span className="text-2xs text-ink-tertiary num-tabular">{formatJalaliTime(lastUpdated)}</span>
          )}
        </div>
      )}
    </div>
  )
}
