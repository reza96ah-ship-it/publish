'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits } from '@/lib/jalali'
import { Flag, MoreHorizontal, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PanelHeader, LinkAction, EmptyState } from './shared'

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

export function CampaignsPanel() {
  const { data } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.getPaginated<Campaign>('/api/campaigns'),
  })
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)

  return (
    <div className="n-card p-5 h-full flex flex-col">
      <PanelHeader
        icon={Flag}
        title="کمپین‌ها"
        subtitle="سلامت و پیشرفت"
        action={<LinkAction onClick={() => navigateTo('/campaigns')}>همه کمپین‌ها ←</LinkAction>}
      />

      <div className="flex-1 overflow-y-auto thin-scrollbar -mx-1 px-1 space-y-2">
        {data?.map((c) => (
          <div key={c.id} className="n-card-compact p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-primary truncate leading-snug">
                  {c.name}
                </p>
                <p className="text-xs text-ink-tertiary mt-0.5 leading-tight">
                  مسئول: {c.owner ?? '—'}
                </p>
              </div>
              <button className="n-focus-ring text-ink-tertiary hover:text-ink-primary shrink-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover">
                <MoreHorizontal className="size-4" strokeWidth={2} />
              </button>
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
            title="هیچ کمپینی وجود ندارد"
            message="کمپین‌های فعال اینجا نمایش داده می‌شوند."
          />
        )}
      </div>
    </div>
  )
}
