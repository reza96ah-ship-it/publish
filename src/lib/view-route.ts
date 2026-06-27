/**
 * View routing — replaces Zustand activeView with URL search params.
 *
 * URL pattern: /?view=<view-name>
 * Examples: /?view=dashboard, /?view=compose, /?view=calendar
 *
 * This gives us: shareable URLs, browser back/forward, bookmarkable views.
 * Keeps Zustand for UI-only state (modals, mobile menu, calendar cursor).
 */

import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useCallback, useMemo } from "react"

export type AppView =
  | "dashboard"
  | "compose"
  | "calendar"
  | "campaigns"
  | "content"
  | "media"
  | "inbox"
  | "analytics"
  | "channels"
  | "settings"

const VALID_VIEWS: AppView[] = [
  "dashboard", "compose", "calendar", "campaigns",
  "content", "media", "inbox", "analytics", "channels", "settings",
]

/**
 * Hook for reading + writing the current view via URL search params.
 * Replaces the old `useAppStore((s) => s.activeView)` + `setActiveView`.
 */
export function useViewRoute() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const view = useMemo<AppView>(() => {
    const v = searchParams.get("view")
    if (v && VALID_VIEWS.includes(v as AppView)) {
      return v as AppView
    }
    return "dashboard"
  }, [searchParams])

  const setView = useCallback((newView: AppView) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newView === "dashboard") {
      params.delete("view") // clean URL for default view
    } else {
      params.set("view", newView)
    }
    const qs = params.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }, [router, searchParams, pathname])

  return { view, setView }
}

/**
 * Get the view from a URL string (for server-side or static use).
 */
export function getViewFromUrl(url: string): AppView {
  try {
    const u = new URL(url, "http://localhost")
    const v = u.searchParams.get("view")
    if (v && VALID_VIEWS.includes(v as AppView)) {
      return v as AppView
    }
  } catch {
    // ignore
  }
  return "dashboard"
}
