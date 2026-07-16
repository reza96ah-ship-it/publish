'use client'

/**
 * Dashboard global filters — URL-persisted state (plan §2A / §10).
 *
 * The URL is the single source of truth: /?range=7d&platform=all
 * Changing a filter rewrites the query string via router.replace (no full
 * reload); opening or sharing the URL reconstructs the same dashboard state.
 *
 * Scope rules (plan §10):
 * - `range` affects KPIs, the performance chart and campaign progress —
 *   NOT connection status, the action queue or live publish progress.
 * - `platform` affects KPIs, the performance chart and the publishing queue.
 */

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { trackClient } from '@/lib/track-client'

export type DashboardRange = '7d' | '30d' | '90d'

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: '7d', label: '۷ روز گذشته' },
  { value: '30d', label: '۳۰ روز گذشته' },
  { value: '90d', label: '۹۰ روز گذشته' },
]

export const PLATFORM_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'همه شبکه‌ها' },
  { value: 'instagram', label: 'اینستاگرام' },
  { value: 'telegram', label: 'تلگرام' },
  { value: 'linkedin', label: 'لینکدین' },
  { value: 'rubika', label: 'روبیکا' },
  { value: 'eitaa', label: 'ایتا' },
]

export function rangeDays(range: DashboardRange): number {
  return range === '90d' ? 90 : range === '30d' ? 30 : 7
}

export interface DashboardFilters {
  range: DashboardRange
  platform: string
  setRange: (r: DashboardRange) => void
  setPlatform: (p: string) => void
}

function isRange(v: string | null): v is DashboardRange {
  return v === '7d' || v === '30d' || v === '90d'
}

export function useDashboardFilters(): DashboardFilters {
  const router = useRouter()
  const searchParams = useSearchParams()

  const rawRange = searchParams.get('range')
  const range: DashboardRange = isRange(rawRange) ? rawRange : '7d'
  const platform = searchParams.get('platform') ?? 'all'

  const setParam = useCallback(
    (key: string, value: string, defaultValue: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value === defaultValue) params.delete(key)
      else params.set(key, value)
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '/', { scroll: false })
    },
    [router, searchParams]
  )

  const setRange = useCallback(
    (r: DashboardRange) => {
      setParam('range', r, '7d')
      trackClient('dashboard_filter_changed', { filterKey: 'range', value: r })
    },
    [setParam]
  )
  const setPlatform = useCallback(
    (p: string) => {
      setParam('platform', p, 'all')
      trackClient('dashboard_filter_changed', { filterKey: 'platform', value: p })
    },
    [setParam]
  )

  return { range, platform, setRange, setPlatform }
}
