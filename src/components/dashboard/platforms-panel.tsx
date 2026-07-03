'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { Link2, MoreHorizontal } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { PanelHeader, LinkAction, EmptyState } from './shared'
import { PlatformLogo } from '@/components/ui/platform-logo'

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

export function PlatformsPanel() {
  const { data } = useQuery<Platform[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated<Platform>('/api/platforms'),
  })
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)

  return (
    <div className="n-card p-5 h-full flex flex-col">
      <PanelHeader
        icon={Link2}
        title="پلتفرم‌ها"
        subtitle="وضعیت اتصال"
        action={<LinkAction onClick={() => navigateTo('/channels')}>مدیریت ←</LinkAction>}
      />

      <div className="flex-1 overflow-y-auto thin-scrollbar -mx-1 px-1 space-y-1.5">
        {data?.map((p) => {
          const healthy = p.state?.includes('متصل') || p.state?.includes('سالم')
          return (
            <div key={p.id} className="n-card-compact flex items-center gap-2.5 p-2.5">
              {/* Real logo with status dot */}
              <div className="relative shrink-0">
                <div className="flex size-9 items-center justify-center rounded-md bg-surface border border-border-subtle">
                  <PlatformLogo platform={p.type} className="size-5" />
                </div>
                <span
                  className={`absolute -bottom-0.5 -end-0.5 size-2.5 rounded-full ring-2 ring-canvas ${healthy ? 'bg-success' : 'bg-danger'}`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-semibold text-ink-primary truncate">{p.name}</p>
                  <span className="text-2xs text-ink-tertiary">
                    @{(p as any).username || '—'}
                  </span>
                </div>
                <span
                  className={`inline-flex items-center text-2xs font-semibold px-1.5 py-0.5 rounded-md border mt-1 ${p.stateColor}`}
                >
                  {p.state}
                </span>
              </div>

              <div className="text-end shrink-0">
                <p className="text-2xs text-ink-tertiary leading-tight">
                  {p.lastSuccess ? relativeTime(new Date(p.lastSuccess)) : '—'}
                </p>
                <p className="text-2xs font-semibold text-ink-secondary mt-0.5 num-tabular leading-tight">
                  {toPersianDigits(p.accounts)} حساب
                </p>
              </div>

              <button className="n-focus-ring text-ink-tertiary hover:text-ink-primary shrink-0 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md hover:bg-surface-hover">
                <MoreHorizontal className="size-4" strokeWidth={2} />
              </button>
            </div>
          )
        })}
        {(!data || data.length === 0) && (
          <EmptyState
            icon={Link2}
            title="هیچ پلتفرمی متصل نیست"
            message="برای شروع، یک پلتفرم را متصل کنید."
          />
        )}
      </div>
    </div>
  )
}
