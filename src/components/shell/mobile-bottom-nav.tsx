'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Send, Calendar, Mail, BarChart3, type LucideIcon } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface BottomNavItem {
  href: string
  icon: LucideIcon
  label: string
  badgeKey?: 'unreadInbox'
}

const NAV_ITEMS: BottomNavItem[] = [
  { href: '/analytics', icon: BarChart3, label: 'تحلیل' },
  { href: '/inbox', icon: Mail, label: 'صندوق ورودی', badgeKey: 'unreadInbox' },
  { href: '/compose', icon: Send, label: 'انتشار' },
  { href: '/calendar', icon: Calendar, label: 'تقویم' },
  { href: '/', icon: LayoutDashboard, label: 'داشبورد' },
]

interface Summary {
  unreadInbox: number
  pendingApproval: number
  failed: number
}

function toPersianDigits(n: number) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

export function MobileBottomNav() {
  const pathname = usePathname()

  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    staleTime: 30000,
  })

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <nav
      aria-label="ناوبری پایین"
      className="fixed bottom-0 inset-x-0 z-30 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="n-glass-nav border-t border-border/60 flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          const badge = item.badgeKey ? (summary?.[item.badgeKey] ?? 0) : 0

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-[10px] font-[500] transition-colors duration-150',
                active ? 'text-accent' : 'text-ink-tertiary',
              )}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-accent"
                  aria-hidden
                />
              )}
              <div className="relative">
                <Icon
                  className={cn(
                    'size-[22px] transition-colors duration-150',
                    active ? 'text-accent' : 'text-ink-tertiary',
                  )}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {badge > 0 && (
                  <span className="absolute -top-1 -end-1.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-danger px-[3px] py-px text-[8px] font-[700] leading-none text-white">
                    {toPersianDigits(Math.min(badge, 99))}
                  </span>
                )}
              </div>
              <span className={cn('leading-none', active ? 'text-accent' : 'text-ink-tertiary')}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
