'use client'

/**
 * وضعیت امروز — single-row status strip (plan §16 phase 2).
 *
 * One flat surface, NOT a card grid: inline stats separated by dividers,
 * reading as a ticker under the header. Health chip leads the row.
 * Zero-value items are dimmed so attention lands on what's non-zero.
 * Each stat is a real button that navigates to its section.
 */

import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { toPersianDigits } from '@/lib/jalali'
import { CountUp } from '@/lib/motion'
import { ErrorState } from './shared'
import { CheckCircle2, AlertTriangle, Zap } from 'lucide-react'

interface Summary {
  health: string
  healthLabel: string
  healthColor: string
  publishedToday: number
  queued: number
  processing: number
  failed: number
  pendingApproval: number
  unreadInbox: number
  activeCampaigns: number
  disconnected: number
  slaRisk: number
}

interface StripItem {
  key: keyof Summary
  label: string
  dot: string
  href: string
  /** critical items keep full opacity even at 0 */
  critical?: boolean
}

/** Ordered by severity — critical first (plan §2C sensibility). */
const STRIP_ITEMS: StripItem[] = [
  { key: 'failed', label: 'انتشار ناموفق', dot: 'bg-danger', href: '/calendar', critical: true },
  { key: 'slaRisk', label: 'ریسک مهلت', dot: 'bg-warning', href: '/campaigns' },
  { key: 'pendingApproval', label: 'در انتظار بازبینی', dot: 'bg-warning', href: '/content' },
  { key: 'unreadInbox', label: 'پیام بدون پاسخ', dot: 'bg-info', href: '/inbox' },
  { key: 'processing', label: 'در حال انتشار', dot: 'bg-accent', href: '/calendar' },
  { key: 'queued', label: 'در صف انتشار', dot: 'bg-info', href: '/calendar' },
  { key: 'publishedToday', label: 'منتشرشده امروز', dot: 'bg-success', href: '/calendar' },
]

export function OperationalSummary() {
  const router = useRouter()
  const { data, isError, refetch } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    refetchInterval: 30000,
    refetchIntervalInBackground: false,
  })

  // Count-up only on the very first data arrival — never on refetch (plan §12).
  const hasAnimatedRef = useRef(false)
  const animateNumbers = !hasAnimatedRef.current
  if (data && !hasAnimatedRef.current) hasAnimatedRef.current = true

  if (isError) {
    return <ErrorState label="دریافت وضعیت امروز با مشکل روبه‌رو شد" onRetry={() => refetch()} />
  }

  const HealthIcon =
    data?.health === 'healthy' ? CheckCircle2 : data?.health === 'warning' ? AlertTriangle : Zap
  const healthTone: Record<string, string> = {
    healthy: 'text-success bg-success-soft border-success/20',
    warning: 'text-warning bg-warning-soft border-warning/20',
    critical: 'text-danger bg-danger-soft border-danger/20',
  }

  return (
    <div className="n-card px-4 py-2">
      {/* Polite live announcement for screen readers (plan §13) */}
      <span className="sr-only" aria-live="polite">
        {data
          ? `${toPersianDigits(data.failed)} انتشار ناموفق، ${toPersianDigits(data.pendingApproval)} مورد در انتظار بازبینی`
          : ''}
      </span>

      <div className="flex flex-wrap items-center gap-y-1">
        {/* Leading label + health chip */}
        <div className="flex items-center gap-2 pe-4 me-1 py-1.5 lg:border-e lg:border-border">
          <h2 className="text-sm font-bold text-ink-primary tracking-tight whitespace-nowrap">
            وضعیت امروز
          </h2>
          {data && (
            <span
              className={`inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-md border ${healthTone[data.health] ?? healthTone.warning}`}
            >
              <HealthIcon className="size-3" strokeWidth={2.5} aria-hidden />
              {data.healthLabel}
            </span>
          )}
        </div>

        {/* Inline stats — divider-separated ticker, no nested cards */}
        {STRIP_ITEMS.map((item) => {
          const value = data?.[item.key] as number | undefined
          const isZero = value === 0
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => router.push(item.href)}
              className={`n-focus-ring group flex min-h-[44px] items-center gap-1.5 rounded-md px-3 transition-colors hover:bg-surface-hover lg:[&:not(:last-child)]:border-e lg:[&:not(:last-child)]:border-border lg:[&:not(:last-child)]:rounded-e-none ${
                isZero && !item.critical ? 'opacity-50 hover:opacity-100' : ''
              }`}
              aria-label={`${item.label}: ${value != null ? toPersianDigits(value) : 'در حال بارگذاری'}`}
            >
              <span className={`size-1.5 rounded-full shrink-0 ${item.dot}`} aria-hidden />
              <span className="text-lg font-bold text-ink-primary num-tabular leading-none">
                {value != null ? (
                  animateNumbers ? (
                    <CountUp value={value} duration={600} />
                  ) : (
                    toPersianDigits(value.toLocaleString('en-US'))
                  )
                ) : (
                  '—'
                )}
              </span>
              <span className="text-xs text-ink-secondary whitespace-nowrap group-hover:text-ink-primary transition-colors">
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
