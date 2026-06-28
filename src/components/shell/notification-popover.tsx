'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { api } from '@/lib/api'
import { toPersianDigits, relativeTime } from '@/lib/jalali'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import {
  Bell,
  CheckCheck,
  MessageCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  UserPlus,
  Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
}

const iconMap: Record<string, { icon: typeof Bell; tint: string }> = {
  publish_success: { icon: CheckCircle2, tint: 'bg-success-soft text-success' },
  publish_failed: { icon: AlertTriangle, tint: 'bg-danger-soft text-danger' },
  approval_requested: { icon: Clock, tint: 'bg-warning-soft text-warning' },
  comment: { icon: MessageCircle, tint: 'bg-info-soft text-info' },
  mention: { icon: Sparkles, tint: 'bg-accent-soft text-accent' },
  new_follower: { icon: UserPlus, tint: 'bg-surface-hover text-ink-secondary' },
}

const defaultIcon = { icon: Bell, tint: 'bg-surface-hover text-ink-secondary' }

function groupByDate(items: Notification[]) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 86400000)
  const weekAgo = new Date(today.getTime() - 7 * 86400000)

  const groups: { label: string; items: Notification[] }[] = [
    { label: 'امروز', items: [] },
    { label: 'دیروز', items: [] },
    { label: 'این هفته', items: [] },
    { label: 'قدیمی‌تر', items: [] },
  ]

  for (const item of items) {
    const d = new Date(item.createdAt)
    if (d >= today) groups[0].items.push(item)
    else if (d >= yesterday) groups[1].items.push(item)
    else if (d >= weekAgo) groups[2].items.push(item)
    else groups[3].items.push(item)
  }

  return groups.filter((g) => g.items.length > 0)
}

export function NotificationPopover() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  // Sprint A: navigation via useViewRoute
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)
  const queryClient = useQueryClient()

  const { data: notifications } = useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: () => api.getPaginated<Notification>('/api/notifications'),
    refetchInterval: 30000,
  })

  const unreadCount = notifications?.filter((n) => !n.isRead).length ?? 0

  const filtered = filter === 'unread' ? notifications?.filter((n) => !n.isRead) : notifications
  const grouped = filtered ? groupByDate(filtered) : []

  const markAllRead = async () => {
    // Optimistic update
    queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
      old?.map((n) => ({ ...n, isRead: true }))
    )
    // Fire and forget — API doesn't have a bulk endpoint yet, that's OK
  }

  const handleItemClick = (notif: Notification) => {
    // Mark as read optimistically
    queryClient.setQueryData<Notification[]>(['notifications'], (old) =>
      old?.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
    )
    // Navigate based on type
    if (notif.type === 'approval_requested') navigateTo('/inbox')
    else if (notif.type === 'publish_failed' || notif.type === 'publish_success')
      navigateTo('/calendar')
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative flex size-10 items-center justify-center rounded-lg n-glass-control text-ink-secondary transition-all hover:text-ink-primary active:scale-[0.96] data-[state=open]:bg-surface-hover"
          aria-label="اعلان‌ها"
        >
          <Bell className="size-[15px]" strokeWidth={2} />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.span
                key={unreadCount}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25, mass: 0.8 }}
                className="absolute -top-1 -right-1 inline-flex min-w-[16px] items-center justify-center rounded-full bg-danger px-1 text-[9.5px] font-[600] text-white ring-2 ring-white num-tabular"
              >
                {toPersianDigits(unreadCount)}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="n-glass-popover w-[380px] max-h-[480px] p-0 overflow-hidden"
      >
        <div className="flex flex-col max-h-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-12 border-b border-border shrink-0">
            <h3 className="text-[13px] font-[700] text-ink-primary">اعلان‌ها</h3>
            <div className="flex items-center gap-1">
              {(['all', 'unread'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className="relative px-2 py-1 text-[11px] font-[600] text-ink-tertiary hover:text-ink-primary transition-colors"
                >
                  {tab === 'all' ? 'همه' : 'خوانده‌نشده'}
                  {filter === tab && (
                    <motion.div
                      layoutId="notif-tab-underline"
                      className="absolute bottom-0 inset-x-0 h-[2px] bg-accent rounded-full"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </button>
              ))}
              <button
                onClick={markAllRead}
                disabled={unreadCount === 0}
                className="ms-1 p-1 rounded-md text-ink-tertiary hover:text-ink-primary hover:bg-surface-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="علامت‌گذاری همه به‌عنوان خوانده‌شده"
                title="علامت‌گذاری همه به‌عنوان خوانده‌شده"
              >
                <CheckCheck className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            {grouped.length > 0 ? (
              <motion.div
                initial="hidden"
                animate="visible"
                variants={{
                  visible: { transition: { staggerChildren: 0.04, delayChildren: 0.05 } },
                }}
              >
                {grouped.map((group) => (
                  <div key={group.label}>
                    <div className="px-4 pt-3 pb-1 text-[10px] font-[600] text-ink-tertiary tracking-wide">
                      {group.label}
                    </div>
                    {group.items.map((notif) => {
                      const { icon: Icon, tint } = iconMap[notif.type] ?? defaultIcon
                      return (
                        <motion.button
                          key={notif.id}
                          variants={{
                            hidden: { opacity: 0, y: 6 },
                            visible: { opacity: 1, y: 0 },
                          }}
                          onClick={() => handleItemClick(notif)}
                          className="relative w-full flex items-start gap-3 px-4 py-3 text-right hover:bg-surface-hover/60 transition-colors group"
                        >
                          <div
                            className={cn(
                              'flex size-8 items-center justify-center rounded-full shrink-0',
                              tint
                            )}
                          >
                            <Icon className="size-3.5" strokeWidth={2} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] text-ink-secondary leading-snug">
                              {notif.title}
                            </p>
                            {notif.body && (
                              <p className="text-[11px] text-ink-tertiary truncate mt-0.5 leading-tight">
                                {notif.body}
                              </p>
                            )}
                            <p className="text-[10px] text-ink-tertiary mt-1 leading-tight">
                              {relativeTime(new Date(notif.createdAt))}
                            </p>
                          </div>
                          {!notif.isRead && (
                            <span className="size-2 rounded-full bg-accent shrink-0 mt-1.5" />
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                ))}
              </motion.div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-xl bg-surface-hover mb-3">
                  <Bell className="size-6 text-ink-tertiary opacity-50" strokeWidth={1.5} />
                </div>
                <p className="text-[13px] font-[600] text-ink-secondary">همه‌چیز رو خوندی</p>
                <p className="text-[11.5px] text-ink-tertiary mt-1">اعلان جدیدی وجود ندارد.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-border h-10 flex items-center justify-center px-4">
            <button
              onClick={() => {
                navigateTo('/inbox')
                setOpen(false)
              }}
              className="text-[11px] font-[600] text-accent hover:text-accent-hover transition-colors"
            >
              مشاهده همه در صندوق ورودی
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
