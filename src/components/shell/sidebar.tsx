'use client'

import { type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Calendar,
  Send,
  Flag,
  Folder,
  Mail,
  BarChart3,
  Link2,
  LayoutGrid,
  Settings,
  LogOut,
  Bell,
  ImageIcon,
  ChevronLeft,
  X,
  Workflow,
} from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
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

interface Summary {
  unreadInbox: number
  pendingApproval: number
  failed: number
}

interface Workspace {
  id: string
  name: string
  plan: string
}

const NAV_MAIN: NavItem[] = [
  { view: 'dashboard', href: '/', icon: LayoutDashboard, label: 'داشبورد' },
  { view: 'compose', href: '/compose', icon: Send, label: 'انتشار' },
  { view: 'calendar', href: '/calendar', icon: Calendar, label: 'تقویم محتوا' },
  { view: 'campaigns', href: '/campaigns', icon: Flag, label: 'کمپین‌ها' },
  { view: 'content', href: '/content', icon: Folder, label: 'کتابخانه محتوا' },
  { view: 'media', href: '/media', icon: ImageIcon, label: 'رسانه' },
  { view: 'smart-pages', href: '/smart-pages', icon: LayoutGrid, label: 'صفحه هوشمند' },
  { view: 'automations', href: '/automations', icon: Workflow, label: 'اتوماسیون' },
  { view: 'inbox', href: '/inbox', icon: Mail, label: 'صندوق ورودی', badgeKey: 'unreadInbox' },
]

const NAV_MANAGE: NavItem[] = [
  { view: 'analytics', href: '/analytics', icon: BarChart3, label: 'تحلیل و گزارش‌ها' },
  { view: 'channels', href: '/channels', icon: Link2, label: 'پلتفرم‌ها و اتصال‌ها' },
  { view: 'settings', href: '/settings', icon: Settings, label: 'تنظیمات' },
]

const PLAN_LABELS: Record<string, string> = {
  free: 'رایگان',
  pro: 'حرفه‌ای',
  business: 'تجاری',
  enterprise: 'سازمانی',
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'مدیر',
  editor: 'ویرایشگر',
  approver: 'تأییدکننده',
  viewer: 'بیننده',
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
          : 'justify-start px-3 py-2 text-sm font-medium',
        isActive
          ? 'bg-accent text-white shadow-sm'
          : 'text-ink-secondary hover:bg-surface-hover/80 hover:text-ink-primary',
      )}
    >
<Icon
        className={cn(
          'shrink-0 transition-colors',
          'size-[17px]',
          isActive ? 'text-white' : 'text-ink-tertiary group-hover:text-ink-primary',
        )}
        strokeWidth={isActive ? 2.2 : 1.9}
      />

      {/* Label */}
      <span className="truncate leading-none">{item.label}</span>

      {/* Badge count */}
      {badge != null && badge > 0 && (
        <span
          className={cn(
            'ms-auto inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-2xs font-bold leading-none num-tabular',
            isActive ? 'bg-white/25 text-white' : 'bg-danger/12 text-danger',
          )}
        >
          {toPersianDigits(badge)}
        </span>
      )}
    </Link>
  )
}

export function Sidebar({ isDrawer = false }: { isDrawer?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const { setMobileMenuOpen } = useAppStore()
  const { data: session } = useSession()

  const { data: summary, isError: summaryError } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    refetchInterval: 30000,
  })

  const { data: workspace } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
    staleTime: 60_000,
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

  // Session-derived user info
  const userName = session?.user?.name ?? ''
  const userImage = session?.user?.image ?? null
  const userRole = ROLE_LABELS[session?.user?.role ?? ''] ?? ''

  // Workspace-derived info
  const wsName = workspace?.name ?? ''
  const wsPlan = PLAN_LABELS[workspace?.plan ?? ''] ?? workspace?.plan ?? ''
  const wsInitial = wsName[0] ?? 'N'

  // Live indicator: connected when summary query succeeded at least once
  const isConnected = !!summary && !summaryError

  return (
    <aside className="n-glass-nav flex h-full w-full flex-col overflow-hidden border-e border-border/60">
      {/* Brand header */}
      <div
        className={cn(
          'flex items-center gap-3 border-b border-border/40',
          'px-4 py-4',
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-accent shadow-sm">
          <span className="text-base font-bold text-white leading-none">N</span>
        </div>
        <div className="flex flex-col leading-tight">
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

        {/* Bell — desktop full sidebar only; opens inbox (notification popover lives in the header) */}
        {!isDrawer && (
          <Link
            href="/inbox"
            className="relative ms-auto rounded-lg p-1.5 text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary transition-colors"
            aria-label="اعلان‌ها"
            title="اعلان‌ها"
          >
            <Bell className="size-[16px]" strokeWidth={2} />
            {notifCount > 0 && (
              <span className="absolute top-1 start-1 size-1.5 rounded-full bg-danger ring-2 ring-canvas" />
            )}
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto no-scrollbar px-2 py-3 space-y-0.5">
        {/* Main section */}
        <p
          className="px-3 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.1em] text-ink-tertiary"
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
          className="px-3 pb-1.5 pt-1 text-2xs font-bold uppercase tracking-[0.1em] text-ink-tertiary"
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

      {/* Help & status links */}
      <div className="px-4 pb-2 flex items-center gap-3 text-2xs text-ink-tertiary">
        <Link href="/help" className="hover:text-ink-secondary transition-colors">
          راهنما
        </Link>
        <span aria-hidden>·</span>
        <Link href="/status" className="hover:text-ink-secondary transition-colors">
          وضعیت سرویس
        </Link>
      </div>

      {/* Bottom section */}
      <div className="border-t border-border/40 px-2 py-3 space-y-1">
        {/* Live indicator — calm dot, no decorative ping (#291) */}
        <div
          className="flex items-center gap-2.5 px-3 py-1.5 justify-start"
        >
          <span className="relative flex size-2 shrink-0">
            <span
              className={cn(
                'relative inline-flex size-2 rounded-full',
                isConnected ? 'bg-success' : 'bg-ink-tertiary',
              )}
            />
          </span>
          <span className="text-2xs font-medium text-ink-tertiary">
            {isConnected ? 'متصل لحظه‌ای' : 'در حال اتصال…'}
          </span>
        </div>

        {/* Workspace — navigate to workspace settings */}
        <Link
          href="/settings"
          onClick={() => setMobileMenuOpen(false)}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-surface-hover/70"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-sm font-bold text-accent">
            {wsInitial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">
              {wsName || <span className="text-ink-tertiary">…</span>}
            </p>
            <p className="text-2xs text-ink-tertiary truncate leading-tight">{wsPlan}</p>
          </div>
          <ChevronLeft className="size-3.5 text-ink-tertiary shrink-0" strokeWidth={2} />
        </Link>

        {/* User row — navigate to profile settings; nested logout button stops propagation */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => {
            setMobileMenuOpen(false)
            router.push('/settings')
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setMobileMenuOpen(false)
              router.push('/settings')
            }
          }}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-hover/70 transition-colors cursor-pointer justify-start"
        >
          {userImage ? (
            <img
              src={userImage}
              alt={userName}
              className="size-8 shrink-0 rounded-full ring-2 ring-border"
            />
          ) : (
            <div className="size-8 shrink-0 rounded-full ring-2 ring-border bg-accent-soft flex items-center justify-center text-sm font-bold text-accent">
              {userName[0] ?? '?'}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate leading-tight">
              {userName || <span className="text-ink-tertiary">…</span>}
            </p>
            {userRole && (
              <p className="text-2xs font-medium text-ink-tertiary truncate leading-tight">{userRole}</p>
            )}
          </div>
          <button
            aria-label="خروج"
            onClick={(e) => {
              e.stopPropagation()
              signOut({ callbackUrl: '/auth/signin' })
            }}
            className="p-1.5 rounded-lg text-ink-tertiary hover:text-danger hover:bg-danger-soft transition-colors"
          >
            <LogOut className="size-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </aside>
  )
}
