'use client'

/**
 * وضعیت کمپین‌ها — campaign health panel (plan §2E).
 * Max 4 rows on the dashboard, real DropdownMenu row actions,
 * content-driven height (no inner scroll), error state with retry.
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits } from '@/lib/jalali'
import { Flag, MoreHorizontal, ArrowLeft, Eye, Pencil } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PanelHeader, LinkAction, EmptyState, ErrorState } from './shared'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Campaign {
  id: string
  name: string
  healthLabel: string
  healthColor: string
  owner: string | null
  daysRemaining: string
  pubProgress: number
  goalCompletion: string
  topBlocker: string | null
}

const MAX_ROWS = 4

export function CampaignsPanel() {
  const { data, isError, refetch } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.getPaginated<Campaign>('/api/campaigns'),
    staleTime: 30_000,
  })
  const router = useRouter()

  if (isError) {
    return <ErrorState label="دریافت وضعیت کمپین‌ها با مشکل روبه‌رو شد" onRetry={() => refetch()} />
  }

  const visible = data?.slice(0, MAX_ROWS)

  return (
    <div className="n-card p-5">
      <PanelHeader
        icon={Flag}
        title="وضعیت کمپین‌ها"
        subtitle="سلامت و پیشرفت"
        action={
          <LinkAction onClick={() => router.push('/campaigns')}>مشاهده همه ←</LinkAction>
        }
      />

      {/* Flat divided rows — matches the table style (no card-in-card) */}
      <div className="divide-y divide-border">
        {visible?.map((c) => (
          <div key={c.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-primary truncate leading-snug">
                  {c.name}
                </p>
                <p className="text-xs text-ink-tertiary mt-0.5 leading-tight">
                  مسئول: {c.owner ?? '—'}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-ink-tertiary shrink-0"
                    aria-label={`اقدامات کمپین ${c.name}`}
                  >
                    <MoreHorizontal className="size-4" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/campaigns?id=${c.id}`)}>
                    <Eye className="size-3.5 me-2" />
                    مشاهده جزئیات
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/campaigns?id=${c.id}&edit=1`)}>
                    <Pencil className="size-3.5 me-2" />
                    ویرایش کمپین
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-2 mb-2.5">
              <span
                className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border ${c.healthColor}`}
              >
                {c.healthLabel}
              </span>
            </div>

            <div className="flex items-center gap-2 mb-1.5">
              <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${c.pubProgress >= 70 ? 'bg-success' : c.pubProgress >= 40 ? 'bg-warning' : 'bg-danger'}`}
                  style={{ width: `${c.pubProgress}%` }}
                />
              </div>
              <span className="text-2xs font-semibold text-ink-secondary num-tabular">
                {toPersianDigits(c.pubProgress)}٪
              </span>
            </div>

            <div className="flex items-center justify-between text-2xs text-ink-tertiary">
              <span>{c.goalCompletion}</span>
              <span className={c.daysRemaining.includes('پایان') ? 'text-danger font-semibold' : ''}>
                {c.daysRemaining}
              </span>
            </div>

            {c.topBlocker && (
              <div className="mt-2 flex items-center gap-1 text-2xs text-warning bg-warning-soft rounded-md px-2 py-1">
                <ArrowLeft className="size-2.5" strokeWidth={2.5} />
                <span>مانع: {c.topBlocker}</span>
              </div>
            )}
          </div>
        ))}
        {(!data || data.length === 0) && (
          <EmptyState
            icon={Flag}
            title="هنوز کمپینی ایجاد نشده است"
            message="برای پیگیری هدف‌ها و عملکرد محتوا، نخستین کمپین را ایجاد کنید."
            size="compact"
          />
        )}
      </div>
    </div>
  )
}
