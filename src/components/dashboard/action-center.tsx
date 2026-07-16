'use client'

/**
 * موارد نیازمند اقدام — the dashboard's action panel (plan §2C).
 *
 * Rules: max 5 visible items, most critical first, content-driven height
 * (no inner scroll), «مشاهده همه موارد» only when more exist. Every row
 * answers: what happened / why it matters / when / what to do now.
 */

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/jalali'
import { toPersianDigits } from '@/lib/jalali'
import { listContainer, listItem } from '@/lib/motion'
import * as Lucide from 'lucide-react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import { PanelHeader, EmptyState, ErrorState, LinkAction } from './shared'

interface ActionItem {
  id: string
  type: string
  title: string
  iconName: string
  color: string
  bg: string
  border: string
  time: string
  isRead: boolean
  href: string | null
}
interface ActionCenterData {
  primary: {
    id: string
    type: string
    title: string
    context: string
    time: string
    action: string
    href: string
  } | null
  secondary: ActionItem[]
}

/** Group labels per plan §2C — the five action groups. */
const GROUP_LABELS: Record<string, string> = {
  publish_failed: 'انتشار ناموفق',
  approval_requested: 'در انتظار بازبینی',
  token_expiring: 'اتصال نیازمند بررسی',
  channel_disconnected: 'اتصال نیازمند بررسی',
  inbox_new: 'پیام بدون پاسخ',
  campaign_at_risk: 'کمپین در معرض تأخیر',
}

/** Criticality order — lower sorts first (plan: موارد بحرانی در ابتدا). */
const SEVERITY: Record<string, number> = {
  publish_failed: 0,
  channel_disconnected: 1,
  token_expiring: 2,
  campaign_at_risk: 3,
  approval_requested: 4,
  inbox_new: 5,
}

const MAX_VISIBLE = 5

export function ActionCenter() {
  const router = useRouter()
  const { data, isError, refetch } = useQuery<ActionCenterData>({
    queryKey: ['dashboard-action-center'],
    queryFn: () => api.get<ActionCenterData>('/api/dashboard/action-center'),
    refetchInterval: 60000,
    refetchIntervalInBackground: false,
  })

  if (isError) {
    return (
      <ErrorState label="دریافت موارد نیازمند اقدام با مشکل روبه‌رو شد" onRetry={() => refetch()} />
    )
  }

  // Sort by criticality; primary always leads. Cap at MAX_VISIBLE total rows.
  const sorted = [...(data?.secondary ?? [])].sort(
    (a, b) => (SEVERITY[a.type] ?? 9) - (SEVERITY[b.type] ?? 9)
  )
  const secondaryBudget = data?.primary ? MAX_VISIBLE - 1 : MAX_VISIBLE
  const visible = sorted.slice(0, secondaryBudget)
  const hiddenCount = sorted.length - visible.length
  const isEmpty = !data?.primary && sorted.length === 0

  return (
    <div className="n-card p-5 flex flex-col">
      <PanelHeader
        icon={AlertTriangle}
        title="موارد نیازمند اقدام"
        subtitle="مرتب‌شده بر اساس اهمیت"
        action={
          hiddenCount > 0 ? (
            <LinkAction onClick={() => router.push('/inbox')}>
              مشاهده همه موارد ({toPersianDigits(sorted.length + (data?.primary ? 1 : 0))})
            </LinkAction>
          ) : undefined
        }
      />

      <div className="space-y-2">
        {/* Primary critical item — what / why / when / action */}
        {data?.primary && (
          <div className="relative overflow-hidden rounded-lg border border-danger/20 bg-danger-soft p-3">
            <div className="absolute top-0 start-0 h-full w-[3px] bg-danger" />
            <div className="flex items-start gap-2 mb-2">
              <span className="flex size-6 items-center justify-center rounded-md bg-danger text-white shrink-0">
                <AlertTriangle className="size-3.5" strokeWidth={2} />
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-2xs font-bold text-danger">
                  {GROUP_LABELS[data.primary.type] ?? 'انتشار ناموفق'}
                </span>
                <p className="text-sm font-semibold text-ink-primary leading-snug">
                  {data.primary.title}
                </p>
                {data.primary.context && (
                  <p className="text-xs text-ink-secondary mt-0.5 leading-snug">
                    {data.primary.context}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-2xs text-ink-tertiary">
                {relativeTime(new Date(data.primary.time))}
              </span>
              <button
                type="button"
                onClick={() => router.push(data.primary?.href ?? '/compose')}
                className="n-focus-ring inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-white bg-danger hover:bg-danger/90 rounded-md px-2.5 transition-colors"
              >
                {data.primary.action}
                <ArrowLeft className="size-3" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        )}

        {/* Remaining items — flat divided list (no nested cards), staggered
            entrance (plan §12: ورود ردیف جدید مجاز است). */}
        {visible.length > 0 && (
          <motion.div
            variants={listContainer}
            initial="hidden"
            animate="visible"
            className="divide-y divide-border"
          >
            {visible.map((item) => {
              const Icon =
                (Lucide as unknown as Record<string, Lucide.LucideIcon>)[item.iconName] ??
                Lucide.Bell
              const interactive = !!item.href
              const group = GROUP_LABELS[item.type]
              const row = (
                <>
                  <span
                    className={`flex size-7 items-center justify-center rounded-md ${item.bg} ${item.color} shrink-0`}
                  >
                    <Icon className="size-3.5" strokeWidth={2} />
                  </span>
                  <div className="flex-1 min-w-0 text-start">
                    {group && <span className={`text-2xs font-bold ${item.color}`}>{group}</span>}
                    <p className="text-xs font-medium text-ink-primary leading-snug">
                      {item.title}
                    </p>
                  </div>
                  <span className="text-2xs text-ink-tertiary shrink-0">
                    {relativeTime(new Date(item.time))}
                  </span>
                </>
              )
              // Actionable rows are real buttons; informational rows are plain
              // divs (plan: non-actionable data must not get role="button").
              return interactive ? (
                <motion.button
                  key={item.id}
                  variants={listItem}
                  type="button"
                  onClick={() => item.href && router.push(item.href)}
                  className="n-focus-ring flex w-full min-h-[44px] items-center gap-2.5 px-1.5 py-2 cursor-pointer rounded-md hover:bg-surface-hover transition-colors"
                >
                  {row}
                </motion.button>
              ) : (
                <motion.div
                  key={item.id}
                  variants={listItem}
                  className="flex min-h-[44px] items-center gap-2.5 px-1.5 py-2"
                >
                  {row}
                </motion.div>
              )
            })}
          </motion.div>
        )}

        {isEmpty && (
          <EmptyState
            icon={Lucide.CheckCircle2}
            title="موردی نیازمند اقدام نیست"
            message="همه انتشارها و اتصال‌ها در وضعیت عادی قرار دارند."
            size="compact"
          />
        )}
      </div>
    </div>
  )
}
