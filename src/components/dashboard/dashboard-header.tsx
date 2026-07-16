'use client'

/**
 * DashboardHeader — page context + global filters (plan §2A / §11 / §12).
 *
 * Start side: workspace chip (§12) → title/subtitle → freshness row with
 * offline badge (§11) and manual stale-refresh button (§11).
 * End side: [range][platform] selects (desktop) · filter sheet (mobile).
 *
 * Filter state lives in the URL via useDashboardFilters.
 * Workspace name fetched from /api/workspace (stale 5 min, no spinner on card).
 */

import { useCallback, useEffect, useState } from 'react'
import { useQueryClient, useQuery } from '@tanstack/react-query'
import { SlidersHorizontal, WifiOff, RefreshCw, Building2, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  useDashboardFilters,
  RANGE_OPTIONS,
  PLATFORM_OPTIONS,
  type DashboardRange,
} from '@/lib/dashboard-filters'
import { api } from '@/lib/api'
import { relativeTime } from '@/lib/jalali'

// ── useOnline ────────────────────────────────────────────────────────────────

function useOnline(): boolean {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

// ── useFreshnessState ────────────────────────────────────────────────────────

/** Reads dashboard-summary query state; exposes label, stale flag, and refresh. */
function useFreshnessState() {
  const queryClient = useQueryClient()
  const [label, setLabel] = useState('همین حالا')
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    const update = () => {
      const state = queryClient.getQueryState(['dashboard-summary'])
      if (!state?.dataUpdatedAt) return
      const ageMs = Date.now() - state.dataUpdatedAt
      setLabel(ageMs < 60_000 ? 'همین حالا' : relativeTime(new Date(state.dataUpdatedAt)))
      setIsStale(ageMs > 120_000)
    }
    update()
    const timer = setInterval(update, 30_000)
    return () => clearInterval(timer)
  }, [queryClient])

  const refresh = useCallback(() => {
    const keys = [
      ['dashboard-metrics'],
      ['dashboard-pulse'],
      ['dashboard-action-center'],
      ['dashboard-summary'],
      ['operational-summary'],
      ['campaigns'],
      ['platforms'],
    ]
    keys.forEach((key) => queryClient.invalidateQueries({ queryKey: key }))
  }, [queryClient])

  return { label, isStale, refresh }
}

// ── useWorkspace ─────────────────────────────────────────────────────────────

function useWorkspace() {
  return useQuery<{ id: string; name: string }>({
    queryKey: ['workspace'],
    queryFn: () => api.get('/api/workspace'),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

// ── FilterSelects ────────────────────────────────────────────────────────────

function FilterSelects({ className = '' }: { className?: string }) {
  const { range, platform, setRange, setPlatform } = useDashboardFilters()
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Select value={range} onValueChange={(v) => setRange(v as DashboardRange)}>
        <SelectTrigger
          className="w-full sm:w-[150px] min-h-[44px] sm:min-h-0 sm:h-9"
          aria-label="بازه زمانی"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={platform} onValueChange={setPlatform}>
        <SelectTrigger
          className="w-full sm:w-[150px] min-h-[44px] sm:min-h-0 sm:h-9"
          aria-label="شبکه اجتماعی"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PLATFORM_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// ── DashboardHeader ──────────────────────────────────────────────────────────

export function DashboardHeader() {
  const { label: freshnessLabel, isStale, refresh } = useFreshnessState()
  const isOnline = useOnline()
  const { data: workspace } = useWorkspace()
  const [sheetOpen, setSheetOpen] = useState(false)
  const router = useRouter()

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {/* Workspace chip (plan §12) — name + chevron hint, navigates to settings */}
        {workspace?.name && (
          <button
            type="button"
            onClick={() => router.push('/settings')}
            className="n-focus-ring inline-flex items-center gap-1 text-xs text-ink-secondary hover:text-ink-primary mb-1.5 rounded transition-colors"
          >
            <Building2 className="size-3 text-ink-tertiary" strokeWidth={2} />
            <span className="font-medium">{workspace.name}</span>
            <ChevronDown className="size-3 text-ink-tertiary" />
          </button>
        )}

        <h1 className="text-xl font-bold text-ink-primary tracking-tight">داشبورد</h1>
        <p className="text-sm text-ink-tertiary mt-0.5">
          مرور عملکرد محتوا و وضعیت انتشارها
        </p>

        {/* Freshness row — last-updated label + offline badge + stale refresh (plan §11) */}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <p className="text-xs text-ink-tertiary num-tabular">
            آخرین به‌روزرسانی: {freshnessLabel}
          </p>

          {!isOnline && (
            <span
              className="inline-flex items-center gap-1 text-2xs font-semibold px-1.5 py-0.5 rounded-md border bg-danger-soft text-danger border-danger/20"
              role="status"
              aria-live="polite"
            >
              <WifiOff className="size-3" aria-hidden />
              آفلاین
            </span>
          )}

          {isOnline && isStale && (
            <button
              type="button"
              onClick={refresh}
              className="n-focus-ring inline-flex items-center gap-1 text-2xs font-semibold text-ink-tertiary hover:text-accent rounded transition-colors"
              aria-label="به‌روزرسانی داده‌های داشبورد"
            >
              <RefreshCw className="size-3" aria-hidden />
              به‌روزرسانی
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ms-auto self-center">
        {/* Desktop filters */}
        <FilterSelects className="hidden sm:flex" />

        {/* Mobile: filters in a bottom sheet */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="sm:hidden min-h-[44px] min-w-[44px]"
              aria-label="فیلترها"
            >
              <SlidersHorizontal className="size-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-8">
            <SheetHeader>
              <SheetTitle>فیلترهای داشبورد</SheetTitle>
            </SheetHeader>
            <div className="mt-4 flex flex-col gap-3 px-1">
              <FilterSelects className="flex-col items-stretch" />
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
