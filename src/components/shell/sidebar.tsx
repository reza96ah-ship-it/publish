'use client'

import { type LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Send,
  Flag,
  Folder,
  Mail,
  BarChart3,
  Link2,
  Settings,
  LogOut,
  Bell,
  ImageIcon,
  ChevronLeft,
  X,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface NavItem {
  view: string
  href: string
  icon: LucideIcon
  label: string
  badgeKey?: 'unreadInbox' | 'pendingApproval' | 'failed'
}

const NAV_MAIN: NavItem[] = [
  { view: 'dashboard', href: '/', icon: LayoutDashboard, label: 'داشبورد' },
  { view: 'compose', href: '/compose', icon: Send, label: 'انتشار' },
  { view: 'calendar', href: '/calendar', icon: Calendar, label: 'تقویم محتوا' },
  { view: 'campaigns', href: '/campaigns', icon: Flag, label: 'کمپین‌ها' },
  { view: 'content', href: '/content', icon: Folder, label: 'کتابخانه محتوا' },
  { view: 'media', href: '/media', icon: ImageIcon, label: 'رسانه' },
  { view: 'inbox', href: '/inbox', icon: Mail, label: 'صندوق ورودی', badgeKey: 'unreadInbox' },
]

const NAV_MANAGE: NavItem[] = [
  { view: 'analytics', href: '/analytics', icon: BarChart3, label: 'تحلیل و گزارش‌ها' },
  { view: 'channels', href: '/channels', icon: Link2, label: 'پلتفرم‌ها و اتصال‌ها' },
  { view: 'settings', href: '/settings', icon: Settings, label: 'تنظیمات' },
]

interface Summary {
  unreadInbox: number
  pendingApproval: number
  failed: number
}

function toPersianDigits(n: number) {
  return String(n).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])
}

function SidebarNavItem({
  item,
  isActive,
  badge,
  isDrawer,
}: {
  item: NavItem
  isActive: boolean
  badge?: number
  isDrawer: boolean
}) {
  const Icon = item.icon
  const { setMobileMenuOpen } = useAppStore()

  return (
    <Link
      href={item.href}
      data-active={isActive || undefined}
      title={isDrawer ? undefined : item.label}
      onClick={() => setMobileMenuOpen(false)}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-xl transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
        isDrawer
          ? 'justify-start px-3 min-h-[48px] py-2.5 text-sm font-semibold'
          : 'justify-center px-2 py-2 text-sm font-medium lg:justify-start lg:px-3 lg:py-2',
        isActive
          ? 'bg-accent text-white shadow-sm'
          : 'text-ink-secondary hover:bg-surface-hover/80 hover:text-ink-primary',
      )}
    >
      {/* Active side accent — desktop only */}
      {!isDrawer && isActive && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute end-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-accent hidden lg:block"
          aria-hidden
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}

      <Icon
        className={cn(
          'shrink-0 transition-colors',
          isDrawer ? 'size-[20px]' : 'size-[18px] lg:size-[17px]',
          isActive ? 'text-white' : 'text-ink-tertiary group-hover:text-ink-primary',
        )}
        strokeWidth={isActive ? 2.2 : 1.9}
      />

      {/* Label */}
      <span className={cn('truncate leading-none', isDrawer ? 'inline' : 'hidden lg:inline')}>
        {item.label}
      </span>

      {/* Badge count */}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            'ms-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-bold leading-none num-tabular',
            isDrawer ? 'inline-flex' : 'hidden lg:inline-flex',
            isActive ? 'bg-white/25 text-white' : 'bg-danger/12 text-danger',
          )}
        >
          {toPersianDigits(badge)}
        </span>
      )}

      {/* Badge dot in icon-rail mode */}
      {!isDrawer && badge != null && badge > 0 && (
        <span className="absolute top-1 end-1 size-1.5 rounded-full bg-danger lg:hidden" aria-hidden />
      )}
    </Link>
  )
}

export function Sidebar({ isDrawer = false }: { isDrawer?: boolean }) {
  const pathname = usePathname()
  const { setMobileMenuOpen } = useAppStore()

  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    refetchInterval: 30000,
  })

  const badgeFor = (key?: NavItem['badgeKey']) => {
    if (!key || !summary) return undefined
    return summary[key]
  }

  const notifCount = (summary?.failed ?? 0) + (summary?.pendingApproval ?? 0)

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="n-glass-nav flex h-full w-full flex-col overflow-hidden border-e border-border/60">
      {/* Brand header */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-border/40',
          isDrawer ? 'px-4 py-4' : 'justify-center px-2 py-3 lg:justify-start lg:px-4 lg:py-4',
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent shadow-sm">
          <span className="text-base font-bold text-white leading-none">N</span>
        </div>
        <div className={cn('flex-col leading-tight', isDrawer ? 'flex' : 'hidden lg:flex')}>
          <span className="text-base font-bold tracking-tight text-ink-primary">نشرینو</span>
          <span className="text-2xs font-semibold text-ink-tertiary tracking-[0.08em]">NASHRINO</span>
        </div>

        {/* Close button — drawer only */}
        {isDrawer && (
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="ms-auto flex size-8 items-center justify-center rounded-lg text-ink-tertiary hover:bg-surface-hover hover:text-ink-primary transition-colors"
            aria-label="بستن منو"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        )}

        {/* Bell — desktop full sidebar only */}
        {!isDrawer && (
          <button
            className="relative ms-auto hidden rounded-lg p-1.5 text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary transition-colors lg:block"
            aria-label="اعلان‌ها"
          >
            <Bell className="size-[16px]" strokeWidth={2} />
            {notifCount > 0 && (
              <span className="absolute top-1 start-1 size-1.5 rounded-full bg-danger ring-2 ring-canvas" />
            )}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-0.5">
        {/* Main section */}
        <p
          className={cn(
            'px-3 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.1em] text-ink-tertiary',
            isDrawer ? 'block' : 'hidden lg:block',
          )}
        >
          منوی اصلی
        </p>
        {NAV_MAIN.map((item) => (
          <SidebarNavItem
            key={item.view}
            item={item}
            isActive={isActive(item.href)}
            badge={badgeFor(item.badgeKey)}
            isDrawer={isDrawer}
          />
        ))}

        {/* Divider */}
        <div className="my-2 border-t border-border/40 mx-1" />

        {/* Manage section */}
        <p
          className={cn(
            'px-3 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.1em] text-ink-tertiary',
            isDrawer ? 'block' : 'hidden lg:block',
          )}
        >
          مدیریت
        </p>
        {NAV_MANAGE.map((item) => (
          <SidebarNavItem
            key={item.view}
            item={item}
            isActive={isActive(item.href)}
            badge={badgeFor(item.badgeKey)}
            isDrawer={isDrawer}
          />
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-border/40 px-2 py-3 space-y-1">
        {/* Live indicator */}
        <div
          className={cn(
            'flex items-center gap-2.5 px-3 py-1.5',
            isDrawer ? 'justify-start' : 'justify-center lg:justify-start',
          )}
        >
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className={cn('text-2xs font-medium text-ink-tertiary', isDrawer ? 'inline' : 'hidden lg:inline')}>
            متصل لحظه‌ای
          </span>
        </div>

        {/* Workspace */}
        <button
          className={cn(
            'w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-surface-hover/70',
            isDrawer ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
            ب
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">برند آرامش</p>
            <p className="text-2xs text-ink-tertiary truncate leading-tight">پلن حرفه‌ای</p>
          </div>
          <ChevronLeft className="size-3.5 text-ink-tertiary shrink-0" strokeWidth={2} />
        </button>

        {/* User row */}
        <div
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-hover/70 transition-colors cursor-pointer',
            isDrawer ? 'justify-start' : 'justify-center lg:justify-start',
          )}
        >
          <img
            src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
            alt="علی احمدی"
            className="size-8 shrink-0 rounded-full ring-2 ring-border"
          />
          <div className={cn('flex-1 min-w-0', isDrawer ? 'block' : 'hidden lg:block')}>
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">علی احمدی</p>
            <p className="text-2xs font-medium text-ink-tertiary truncate leading-tight">مدیر عملیات</p>
          </div>
          <button
            aria-label="خروج"
            className={cn(
              'p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft transition-colors',
              isDrawer ? 'block' : 'hidden lg:block',
            )}
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}
