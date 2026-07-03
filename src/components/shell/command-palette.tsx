'use client'

import { useEffect } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { motion, AnimatePresence } from 'framer-motion'
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
  ImageIcon,
  Search,
  Plus,
  Sparkles,
  Bell,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { toPersianDigits } from '@/lib/jalali'
import { modalBackdrop, modalContent } from '@/lib/motion'

interface NavAction {
  id: string
  label: string
  icon: typeof LayoutDashboard
  shortcut?: string
  group: 'pages' | 'actions'
  onSelect: () => void
}

export function CommandPalette() {
  const router = useRouter()
  const { isCommandPaletteOpen, setCommandPaletteOpen, setMobileMenuOpen } = useAppStore()

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setCommandPaletteOpen(!isCommandPaletteOpen)
      }
      if (e.key === 'Escape' && isCommandPaletteOpen) {
        setCommandPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isCommandPaletteOpen, setCommandPaletteOpen])

  const go = (path: string) => {
    router.push(path)
    setMobileMenuOpen(false)
    setCommandPaletteOpen(false)
  }

  const actions: NavAction[] = [
    // Pages
    {
      id: 'dashboard',
      label: 'داشبورد',
      icon: LayoutDashboard,
      shortcut: 'G D',
      group: 'pages',
      onSelect: () => go('/'),
    },
    {
      id: 'compose',
      label: 'انتشار جدید',
      icon: Send,
      shortcut: 'C',
      group: 'pages',
      onSelect: () => go('/compose'),
    },
    {
      id: 'calendar',
      label: 'تقویم محتوا',
      icon: Calendar,
      group: 'pages',
      onSelect: () => go('/calendar'),
    },
    {
      id: 'campaigns',
      label: 'کمپین‌ها',
      icon: Flag,
      group: 'pages',
      onSelect: () => go('/campaigns'),
    },
    {
      id: 'content',
      label: 'کتابخانه محتوا',
      icon: Folder,
      group: 'pages',
      onSelect: () => go('/content'),
    },
    { id: 'media', label: 'رسانه', icon: ImageIcon, group: 'pages', onSelect: () => go('/media') },
    { id: 'inbox', label: 'صندوق ورودی', icon: Mail, group: 'pages', onSelect: () => go('/inbox') },
    {
      id: 'analytics',
      label: 'تحلیل و گزارش‌ها',
      icon: BarChart3,
      group: 'pages',
      onSelect: () => go('/analytics'),
    },
    {
      id: 'channels',
      label: 'پلتفرم‌ها و اتصال‌ها',
      icon: Link2,
      group: 'pages',
      onSelect: () => go('/channels'),
    },
    {
      id: 'settings',
      label: 'تنظیمات',
      icon: Settings,
      group: 'pages',
      onSelect: () => go('/settings'),
    },
    // Actions
    {
      id: 'new-publish',
      label: 'انتشار محتوای جدید',
      icon: Plus,
      shortcut: 'C',
      group: 'actions',
      onSelect: () => go('/compose'),
    },
    {
      id: 'ai-assistant',
      label: 'باز کردن دستیار هوش مصنوعی',
      icon: Sparkles,
      group: 'actions',
      onSelect: () => go('/compose'),
    },
    {
      id: 'search-content',
      label: 'جستجوی محتوا…',
      icon: Search,
      group: 'actions',
      onSelect: () => go('/content'),
    },
    {
      id: 'view-notifications',
      label: 'مشاهده اعلان‌ها',
      icon: Bell,
      group: 'actions',
      onSelect: () => go('/inbox'),
    },
  ]

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh]">
          {/* Backdrop */}
          <motion.div
            variants={modalBackdrop}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.15, ease: 'linear' }}
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Palette */}
          <motion.div
            variants={modalContent}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 26, mass: 1 }}
            className="relative w-full max-w-[560px] mx-4 n-glass-popover overflow-hidden"
            style={{ transformOrigin: 'top center' }}
            role="dialog"
            aria-label="پنل فرمان"
          >
            <CommandPrimitive className="flex flex-col" shouldFilter loop>
              {/* Input row */}
              <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
                <Search className="size-[18px] text-ink-tertiary shrink-0" strokeWidth={2} />
                <CommandPrimitive.Input
                  autoFocus
                  placeholder="جستجو یا اجرای فرمان…"
                  className="flex-1 bg-transparent text-base text-ink-primary placeholder:text-ink-tertiary outline-none"
                />
                <kbd className="text-2xs font-semibold text-ink-tertiary px-1.5 py-0.5 rounded border border-border bg-surface-hover shrink-0">
                  ESC
                </kbd>
              </div>

              {/* List */}
              <CommandPrimitive.List className="max-h-[400px] overflow-y-auto thin-scrollbar">
                <CommandPrimitive.Empty>
                  <div className="py-12 text-center">
                    <Search
                      className="size-8 mx-auto text-ink-tertiary opacity-40 mb-2"
                      strokeWidth={1.5}
                    />
                    <p className="text-sm text-ink-secondary font-medium">نتیجه‌ای پیدا نشد</p>
                    <p className="text-xs text-ink-tertiary mt-1">
                      برای دیدن همه فرمان‌ها، جستجو را خالی کنید
                    </p>
                  </div>
                </CommandPrimitive.Empty>

                {/* Pages group */}
                <CommandPrimitive.Group
                  heading="مسیرها"
                  className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-tertiary [&_[cmdk-group-heading]]:tracking-wide"
                >
                  {actions
                    .filter((a) => a.group === 'pages')
                    .map((action) => (
                      <CommandItem key={action.id} action={action} />
                    ))}
                </CommandPrimitive.Group>

                {/* Actions group */}
                <CommandPrimitive.Group
                  heading="عملیات"
                  className="[&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-2xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-ink-tertiary [&_[cmdk-group-heading]]:tracking-wide border-t border-border"
                >
                  {actions
                    .filter((a) => a.group === 'actions')
                    .map((action) => (
                      <CommandItem key={action.id} action={action} />
                    ))}
                </CommandPrimitive.Group>
              </CommandPrimitive.List>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 h-9 border-t border-border text-2xs text-ink-tertiary">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 rounded border border-border bg-surface-hover">↑↓</kbd>
                    جهت‌یابی
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 rounded border border-border bg-surface-hover">↵</kbd>
                    انتخاب
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 rounded border border-border bg-surface-hover">esc</kbd>
                    بستن
                  </span>
                </div>
              </div>
            </CommandPrimitive>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function CommandItem({ action }: { action: NavAction }) {
  const Icon = action.icon
  return (
    <CommandPrimitive.Item
      onSelect={action.onSelect}
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer data-[selected=true]:bg-surface-hover transition-colors group"
    >
      <Icon
        className="size-4 text-ink-tertiary group-data-[selected=true]:text-accent shrink-0"
        strokeWidth={2}
      />
      <span className="flex-1 text-sm text-ink-primary font-medium">{action.label}</span>
      {action.shortcut && (
        <span className="flex items-center gap-1 text-2xs text-ink-tertiary shrink-0">
          {action.shortcut.split(' ').map((key, i) => (
            <kbd
              key={i}
              className="px-1.5 py-0.5 rounded border border-border bg-surface-hover font-semibold"
            >
              {key}
            </kbd>
          ))}
        </span>
      )}
    </CommandPrimitive.Item>
  )
}
