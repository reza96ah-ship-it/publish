'use client'

import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AmbientMesh } from './ambient-mesh'
import { useAppStore } from '@/lib/store'
import { Sidebar } from './sidebar'
import { CommandBar } from './command-bar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { Menu, X, Bell } from 'lucide-react'
import { api } from '@/lib/api'
import { usePublishStream } from '@/hooks/use-publish-stream'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { CommandPalette } from './command-palette'
import { ShortcutsModal } from './shortcuts-modal'

function RealtimeProvider() {
  const { data: workspaceId } = useQuery<string>({
    queryKey: ['workspace-id'],
    queryFn: async () => {
      const ws = await api.get<{ id: string }>('/api/workspace')
      return ws.id
    },
    staleTime: Infinity,
  })
  usePublishStream(workspaceId)
  return null
}

export function AppShell({ children }: { children: ReactNode }) {
  const isMobileMenuOpen = useAppStore((s) => s.isMobileMenuOpen)
  const setMobileMenuOpen = useAppStore((s) => s.setMobileMenuOpen)
  useKeyboardShortcuts()

  return (
    <div className="relative flex h-dvh w-full overflow-hidden">
      <AmbientMesh />
      <RealtimeProvider />
      <CommandPalette />
      <ShortcutsModal />

      {/* Skip link — WCAG 2.4.1 Level A bypass block */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:right-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-[13px] focus:font-[600] focus:text-white focus:shadow-lg focus:outline-none"
      >
        پرش به محتوای اصلی
      </a>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — glass navigation (fixed drawer on mobile, static on desktop) */}
      <nav aria-label="ناوبری اصلی">
        <div
          className={`fixed inset-y-0 right-0 z-40 w-[260px] transform transition-transform duration-300 lg:static lg:z-auto lg:translate-x-0 ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <Sidebar />
        </div>
      </nav>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="n-glass-control flex size-11 items-center justify-center text-ink-primary"
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent">
              <span className="text-[13px] font-[700] text-white leading-none">N</span>
            </div>
            <span className="text-[13.5px] font-[700] text-ink-primary tracking-tight">نشرینو</span>
          </div>
          <button
            className="n-glass-control relative flex size-11 items-center justify-center text-ink-secondary"
            aria-label="اعلان‌ها"
          >
            <Bell className="size-[18px]" strokeWidth={1.8} />
          </button>
        </header>

        {/* Desktop command bar slot — glass toolbar */}
        <div className="hidden px-[var(--shell-gutter)] pt-[var(--shell-gap)] lg:block">
          <CommandBar />
        </div>

        {/* Scrollable content stage — solid surfaces */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto thin-scrollbar px-[var(--shell-gutter)] py-[var(--shell-gap)]"
          tabIndex={-1}
        >
          {/* pb-[...] accounts for bottom nav (56px) + safe-area + breathing room on mobile; lg: resets to pb-10 */}
          <div className="mx-auto w-full max-w-[1600px] pb-[calc(56px+env(safe-area-inset-bottom)+2.5rem)] lg:pb-10">
            {children}
          </div>
        </main>
      </div>

      <MobileBottomNav />

      {/* Close button on mobile drawer */}
      {isMobileMenuOpen && (
        <button
          onClick={() => setMobileMenuOpen(false)}
          className="fixed top-4 left-4 z-50 n-glass-control flex size-10 items-center justify-center text-ink-primary lg:hidden"
          aria-label="بستن منو"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  )
}
