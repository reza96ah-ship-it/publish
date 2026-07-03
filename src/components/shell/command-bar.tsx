'use client'

import { motion } from 'framer-motion'
import { Search, Plus, Sparkles, Keyboard } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { toPersianDigits } from '@/lib/jalali'
import { NotificationPopover } from './notification-popover'
import { ThemeToggle } from './theme-toggle'

interface Summary {
  unreadInbox: number
  failed: number
  pendingApproval: number
}

export function CommandBar() {
  const router = useRouter()
  const navigateTo = (path: string) => router.push(path)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setShortcutsOpen = useAppStore((s) => s.setShortcutsOpen)
  const { data: summary } = useQuery<Summary>({
    queryKey: ['dashboard-summary'],
    queryFn: () => api.get<Summary>('/api/dashboard/summary'),
    refetchInterval: 30000,
  })

  return (
    <div className="flex items-center gap-2">
      {/* Search — opens command palette on click */}
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="n-glass-control n-focus-ring flex h-10 flex-1 items-center gap-2.5 px-3.5 text-ink-tertiary transition-colors hover:text-ink-secondary"
      >
        <Search className="size-[15px]" strokeWidth={2} />
        <span className="text-sm font-medium">جستجوی محتوا، کمپین، رسانه…</span>
        <kbd className="ms-auto hidden rounded border border-border bg-surface-hover px-1.5 py-0.5 text-2xs font-semibold text-ink-tertiary sm:block">
          ⌘K
        </kbd>
      </button>

      {/* Keyboard shortcuts hint — opens shortcuts modal */}
      <button
        onClick={() => setShortcutsOpen(true)}
        className="n-glass-control n-focus-ring hidden h-10 items-center justify-center gap-2 px-3 text-ink-tertiary transition-colors hover:text-ink-secondary md:flex"
        aria-label="میانبرهای صفحه‌کلید"
        title="میانبرهای صفحه‌کلید (؟)"
      >
        <Keyboard className="size-[15px]" strokeWidth={2} />
        <kbd className="rounded border border-border bg-surface-hover px-1.5 py-0.5 text-2xs font-semibold text-ink-tertiary">
          ؟
        </kbd>
      </button>

      {/* Quick create — solid accent (primary action) */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15, ease: [0.12, 0, 0.08, 1] }}
        onClick={() => navigateTo('/compose')}
        className="n-focus-ring flex h-10 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-accent-hover"
      >
        <Plus className="size-4" strokeWidth={2.5} />
        <span className="hidden sm:block">انتشار جدید</span>
      </motion.button>

      {/* AI assistant — glass control */}
      <button
        onClick={() => navigateTo('/compose')}
        className="n-glass-control n-focus-ring hidden h-10 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold text-ink-secondary transition-colors hover:text-ink-primary md:flex"
      >
        <Sparkles className="size-4 text-accent" strokeWidth={2} />
        <span>دستیار هوش مصنوعی</span>
      </button>

      {/* Notifications — popover */}
      <NotificationPopover />

      {/* Theme toggle — light/dark */}
      <ThemeToggle />
    </div>
  )
}
