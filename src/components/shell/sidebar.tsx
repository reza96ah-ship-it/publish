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
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface NavItem {
  view: string
  href: string
  icon: LucideIcon
  label: string
  badgeKey?: 'unreadInbox' | 'pendingApproval' | 'failed'
}

const navItems: NavItem[] = [
  { view: 'dashboard', href: '/', icon: LayoutDashboard, label: 'داشبورد' },
  { view: 'compose', href: '/compose', icon: Send, label: 'انتشار' },
  { view: 'calendar', href: '/calendar', icon: Calendar, label: 'تقویم محتوا' },
  { view: 'campaigns', href: '/campaigns', icon: Flag, label: 'کمپین‌ها' },
  { view: 'content', href: '/content', icon: Folder, label: 'کتابخانه محتوا' },
  { view: 'media', href: '/media', icon: ImageIcon, label: 'رسانه' },
  { view: 'inbox', href: '/inbox', icon: Mail, label: 'صندوق ورودی', badgeKey: 'unreadInbox' },
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
}: {
  item: NavItem
  isActive: boolean
  badge?: number
}) {
  const Icon = item.icon
  const { setMobileMenuOpen } = useAppStore()
  return (
    <Link
      href={item.href}
      data-active={isActive || undefined}
      title={item.label}
      onClick={() => setMobileMenuOpen(false)}
      className="group relative flex w-full items-center justify-center gap-2.5 rounded-md px-2.5 py-[7px] text-sm font-medium transition-colors duration-150 text-ink-secondary hover:bg-surface-hover/70 hover:text-ink-primary data-[active]:bg-accent data-[active]:text-white data-[active]:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 lg:justify-start"
    >
      {isActive && (
        <motion.span
          layoutId="sidebar-active-indicator"
          className="absolute end-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent hidden lg:block"
          aria-hidden
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        />
      )}
      {!isActive && (
        <span
          className="absolute end-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-accent opacity-0 group-hover:opacity-30 transition-opacity duration-150 hidden lg:block"
          aria-hidden
        />
      )}
      <Icon
        className="size-[18px] shrink-0 text-ink-tertiary group-data-[active]:text-white/95 transition-colors lg:size-[16px]"
        strokeWidth={2}
      />
      <span className="hidden truncate lg:inline">{item.label}</span>
      {badge != null && badge > 0 && (
        <span className="ms-auto hidden lg:inline-flex min-w-[18px] items-center justify-center rounded-full bg-danger/12 px-1.5 py-0.5 text-2xs font-semibold leading-none text-danger num-tabular group-data-[active]:bg-white/20 group-data-[active]:text-white">
          {toPersianDigits(badge)}
        </span>
      )}
      {/* Badge dot in icon-rail mode (md only) */}
      {badge != null && badge > 0 && (
        <span className="absolute top-1 end-1 size-1.5 rounded-full bg-danger lg:hidden" aria-hidden />
      )}
    </Link>
  )
}

export function Sidebar() {
  const pathname = usePathname()

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

  // Derive active state from pathname
  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <aside className="n-glass-nav flex h-full w-full flex-col overflow-hidden rounded-none border-x border-t border-b-0">
      {/* Brand Header — icon only at md rail, full at lg */}
      <div className="flex items-center justify-center gap-2.5 px-2 pt-4 pb-3 lg:justify-start lg:px-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent shadow-sm">
          <span className="text-base font-bold text-white leading-none">N</span>
        </div>
        <div className="hidden flex-col leading-tight lg:flex">
          <span className="text-base font-bold tracking-tight text-ink-primary">نشرینو</span>
          <span className="text-2xs font-semibold text-ink-tertiary tracking-[0.1em]">
            NASHRINO
          </span>
        </div>
        <button
          className="relative ms-auto hidden rounded-md p-1.5 text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary transition-colors lg:block"
          aria-label="اعلان‌ها"
        >
          <Bell className="size-[16px]" strokeWidth={2} />
          {notifCount > 0 && (
            <span className="absolute top-1 start-1 size-1.5 rounded-full bg-danger ring-2 ring-canvas" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-1.5 py-1 space-y-px lg:px-2">
        <p className="hidden px-2.5 pb-1 pt-2 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-tertiary lg:block">
          منوی اصلی
        </p>
        {navItems.slice(0, 7).map((item) => (
          <SidebarNavItem
            key={item.view}
            item={item}
            isActive={isActive(item.href)}
            badge={badgeFor(item.badgeKey)}
          />
        ))}
        <p className="hidden px-2.5 pb-1 pt-3 text-2xs font-semibold uppercase tracking-[0.1em] text-ink-tertiary lg:block">
          مدیریت
        </p>
        {navItems.slice(7).map((item) => (
          <SidebarNavItem
            key={item.view}
            item={item}
            isActive={isActive(item.href)}
            badge={badgeFor(item.badgeKey)}
          />
        ))}
      </nav>

      {/* Bottom Section — condensed icon rail at md, full at lg */}
      <div className="mt-auto border-t border-border/60 px-1.5 py-2 space-y-px lg:px-2">
        {/* Live indicator */}
        <div className="flex items-center justify-center gap-2 px-2.5 py-1 lg:justify-start">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-success" />
          </span>
          <span className="hidden text-2xs font-medium text-ink-tertiary lg:inline">متصل لحظه‌ای</span>
        </div>

        {/* Workspace — hidden in rail */}
        <button className="hidden w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start transition-colors hover:bg-surface-hover/70 lg:flex">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-xs font-bold text-accent">
            ب
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">
              برند آرامش
            </p>
            <p className="text-2xs text-ink-tertiary truncate leading-tight">پلن حرفه‌ای</p>
          </div>
          <ChevronLeft className="size-3.5 text-ink-tertiary shrink-0" strokeWidth={2} />
        </button>

        {/* User row — avatar only in rail, full at lg */}
        <div className="flex items-center justify-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-surface-hover/70 transition-colors cursor-pointer lg:justify-start">
          <img
            src="https://i.pravatar.cc/150?u=a042581f4e29026704d"
            alt="علی احمدی"
            className="size-7 shrink-0 rounded-full"
          />
          <div className="hidden flex-1 min-w-0 lg:block">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">
              علی احمدی
            </p>
            <p className="text-2xs font-medium text-ink-tertiary truncate leading-tight">
              مدیر عملیات
            </p>
          </div>
          <button
            aria-label="خروج"
            className="hidden p-1 rounded-md text-ink-tertiary hover:text-danger hover:bg-danger-soft transition-colors lg:block"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}
