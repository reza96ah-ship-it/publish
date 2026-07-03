'use client'

import { type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AmbientMesh } from './ambient-mesh'
import { useAppStore } from '@/lib/store'
import { Sidebar } from './sidebar'
import { CommandBar } from './command-bar'
import { MobileBottomNav } from './mobile-bottom-nav'
import { Menu, Bell } from 'lucide-react'
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
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:end-4 focus:z-[100] focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-white focus:shadow-lg focus:outline-none"
      >
        پرش به محتوای اصلی
      </a>

      {/* Mobile overlay — visible only below md */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden
        />
      )}

      {/* Sidebar — icon rail at md, full at lg, right-side drawer below md */}
      <nav aria-label="ناوبری اصلی">
        <div
          className={`fixed inset-y-0 start-0 z-40 w-[260px] transform transition-transform duration-300 ease-out md:static md:z-auto md:w-[240px] md:translate-x-0 lg:w-[260px] ${
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'
          }`}
        >
          <Sidebar isDrawer={isMobileMenuOpen} />
        </div>
      </nav>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — hidden at md+ (sidebar is always visible) */}
        <header className="flex items-center justify-between px-4 py-3 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="n-glass-control flex size-11 items-center justify-center text-ink-primary"
            aria-label="باز کردن منو"
          >
            <Menu className="size-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-md bg-accent">
              <span className="text-sm font-bold text-white leading-none">N</span>
            </div>
            <span className="text-base font-bold text-ink-primary tracking-tight">نشرینو</span>
          </div>
          <button
            className="n-glass-control relative flex size-11 items-center justify-center text-ink-secondary"
            aria-label="اعلان‌ها"
          >
            <Bell className="size-[18px]" strokeWidth={1.8} />
          </button>
        </header>

        {/* Command bar — visible from md+ */}
        <div className="hidden px-[var(--shell-gutter)] pt-[var(--shell-gap)] md:block">
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
    </div>
  )
}
