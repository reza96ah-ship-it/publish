'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Send,
  Calendar,
  Mail,
  BarChart3,
  Flag,
  Folder,
  ImageIcon,
  Link2,
  Settings,
  Radar,
  Building2,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

interface BottomNavItem {
  href: string
  icon: LucideIcon
  label: string
  badgeKey?: 'unreadInbox'
}

// Five most important routes shown as primary icons in the bottom bar.
const PRIMARY_ITEMS: BottomNavItem[] = [
  { href: '/', icon: LayoutDashboard, label: 'داشبورد' },
  { href: '/compose', icon: Send, label: 'انتشار' },
  { href: '/inbox', icon: Mail, label: 'صندوق ورودی', badgeKey: 'unreadInbox' },
  { href: '/calendar', icon: Calendar, label: 'تقویم' },
  { href: '/analytics', icon: BarChart3, label: 'تحلیل' },
]

// Remaining routes reachable through the "More" bottom sheet.
const MORE_ITEMS: BottomNavItem[] = [
  { href: '/campaigns', icon: Flag, label: 'کمپین‌ها' },
  { href: '/content', icon: Folder, label: 'کتابخانه محتوا' },
  { href: '/media', icon: ImageIcon, label: 'رسانه' },
  { href: '/listening', icon: Radar, label: 'گوش دادن' },
  { href: '/agency', icon: Building2, label: 'آژانس' },
  { href: '/channels', icon: Link2, label: 'پلتفرم‌ها' },
  { href: '/settings', icon: Settings, label: 'تنظیمات' },
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
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)

  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    staleTime: 30000,
  })

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  // The "More" trigger is highlighted when any of its child routes is active.
  const moreActive = MORE_ITEMS.some((item) => isActive(item.href))

  const handleMoreItemClick = (href: string) => {
    setMoreOpen(false)
    router.push(href)
  }

  return (
    <>
      <nav
        aria-label="ناوبری پایین"
        className="fixed bottom-0 inset-x-0 z-30 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="n-glass-nav border-t border-border/60 flex items-stretch">
          {PRIMARY_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
            const badge = item.badgeKey ? (summary?.[item.badgeKey] ?? 0) : 0

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-2xs font-medium transition-colors duration-150',
                  active ? 'text-accent' : 'text-ink-tertiary',
                )}
              >
                {active && (
                  <span
                    className="absolute top-0 inset-x-0 mx-auto h-[2px] w-6 rounded-full bg-accent"
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
                    <span className="absolute -top-1 -end-1.5 inline-flex min-w-[14px] items-center justify-center rounded-full bg-danger px-[3px] py-px text-2xs font-bold leading-none text-white">
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

          {/* More button — opens a bottom sheet with the remaining routes */}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            aria-label="بیشتر"
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-0.5 min-h-[56px] py-2 text-2xs font-medium transition-colors duration-150',
              moreActive ? 'text-accent' : 'text-ink-tertiary',
            )}
          >
            {moreActive && (
              <span
                className="absolute top-0 inset-x-0 mx-auto h-[2px] w-6 rounded-full bg-accent"
                aria-hidden
              />
            )}
            <MoreHorizontal
              className={cn(
                'size-[22px] transition-colors duration-150',
                moreActive ? 'text-accent' : 'text-ink-tertiary',
              )}
              strokeWidth={moreActive ? 2.2 : 1.8}
            />
            <span className={cn('leading-none', moreActive ? 'text-accent' : 'text-ink-tertiary')}>
              بیشتر
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="p-0 gap-0">
          <SheetHeader className="text-start pb-2">
            <SheetTitle className="text-start text-base">بیشتر</SheetTitle>
            <SheetDescription className="text-start">
              سایر بخش‌های نشرینو
            </SheetDescription>
          </SheetHeader>
          <div
            className="grid grid-cols-3 gap-2 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            role="list"
          >
            {MORE_ITEMS.map((item) => {
              const Icon = item.icon
              const active = isActive(item.href)
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => handleMoreItemClick(item.href)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex flex-col items-center justify-center gap-2 rounded-xl p-3 min-h-[80px] text-center transition-colors',
                    active
                      ? 'bg-accent-soft text-accent ring-1 ring-accent/20'
                      : 'bg-surface-subtle hover:bg-surface-hover text-ink-secondary',
                  )}
                >
                  <Icon className="size-5" strokeWidth={2} />
                  <span className="text-xs font-semibold leading-tight">{item.label}</span>
                </button>
              )
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
