'use client'

/**
 * اتصال حساب‌ها — account connection health panel (plan §2E).
 * Max 4 rows, real DropdownMenu row actions, content-driven height,
 * error state. Time filter never affects this panel (plan §10).
 */

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { Link2, MoreHorizontal, RefreshCw, Settings2, Unplug } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { PanelHeader, LinkAction, EmptyState, ErrorState } from './shared'
import { PlatformLogo } from '@/components/ui/platform-logo'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Platform {
  id: string
  name: string
  type: string
  logo: string
  state: string
  stateColor: string
  accounts: number
  primaryIssue: string | null
  lastSuccess: string | null
  accountKind: string
  circuitState: string
}

const MAX_ROWS = 4

export function PlatformsPanel() {
  const { data, isError, refetch } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated<Platform>('/api/platforms'),
    staleTime: 30_000,
  })
  const router = useRouter()

  if (isError) {
    return <ErrorState label="دریافت وضعیت اتصال‌ها با مشکل روبه‌رو شد" onRetry={() => refetch()} />
  }

  const visible = data?.slice(0, MAX_ROWS)

  return (
    <div className="n-card p-5">
      <PanelHeader
        icon={Link2}
        title="اتصال حساب‌ها"
        subtitle="وضعیت اتصال شبکه‌ها"
        action={<LinkAction onClick={() => router.push('/channels')}>مدیریت ←</LinkAction>}
      />

      {/* Flat divided rows — matches the table style (no card-in-card) */}
      <div className="divide-y divide-border">
        {visible?.map((p) => {
          const healthy = p.state?.includes('متصل') || p.state?.includes('سالم')
          return (
            <div key={p.id} className="flex items-center gap-2.5 py-2.5">
              {/* Logo + status dot: color plus text state below (plan §13) */}
              <div className="relative shrink-0">
                <div className="flex size-9 items-center justify-center rounded-md bg-surface border border-border-subtle">
                  <PlatformLogo platform={p.type} className="size-5" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full ring-2 ring-canvas ${healthy ? 'bg-success' : 'bg-danger'}`}
                  aria-hidden
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-ink-primary truncate">{p.name}</p>
                  <span className="text-2xs text-ink-tertiary">
                    @{(p as unknown as { username?: string }).username || '—'}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border mt-1 ${p.stateColor}`}
                >
                  {p.state}
                </span>
                {p.primaryIssue && (
                  <p className="text-2xs text-danger mt-1 leading-tight">{p.primaryIssue}</p>
                )}
              </div>

              <div className="text-end shrink-0">
                <p className="text-2xs text-ink-tertiary leading-tight">
                  {p.lastSuccess ? relativeTime(new Date(p.lastSuccess)) : '—'}
                </p>
                <p className="text-2xs font-semibold text-ink-secondary mt-0.5 num-tabular leading-tight">
                  {toPersianDigits(p.accounts)} حساب
                </p>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-ink-tertiary shrink-0"
                    aria-label={`اقدامات حساب ${p.name}`}
                  >
                    <MoreHorizontal className="size-4" strokeWidth={2} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => router.push(`/channels?id=${p.id}`)}>
                    <RefreshCw className="size-3.5 me-2" />
                    بررسی اتصال
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push(`/channels?id=${p.id}`)}>
                    <Settings2 className="size-3.5 me-2" />
                    تنظیمات حساب
                  </DropdownMenuItem>
                  {!healthy && (
                    <DropdownMenuItem onClick={() => router.push('/channels')}>
                      <Unplug className="size-3.5 me-2" />
                      اتصال مجدد
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
        {(!data || data.length === 0) && (
          <EmptyState
            icon={Link2}
            title="هیچ حسابی متصل نیست"
            message="برای شروع، یک شبکه اجتماعی را متصل کنید."
            size="compact"
          />
        )}
      </div>
    </div>
  )
}
