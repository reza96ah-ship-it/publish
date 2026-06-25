import { create } from 'zustand'

export type AppView =
  | 'dashboard'
  | 'compose'
  | 'calendar'
  | 'campaigns'
  | 'content'
  | 'media'
  | 'inbox'
  | 'analytics'
  | 'channels'
  | 'settings'

interface AppState {
  activeView: AppView
  setActiveView: (view: AppView) => void
  isMobileMenuOpen: boolean
  setMobileMenuOpen: (open: boolean) => void
  isCommandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void
  isShortcutsOpen: boolean
  setShortcutsOpen: (open: boolean) => void
  calendarCursor: { year: number; month: number }
  setCalendarCursor: (y: number, m: number) => void
}

// Default to current Jalali month
function defaultCursor() {
  const now = new Date()
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = now.getMonth() > 1 ? now.getFullYear() + 1 : now.getFullYear()
  let days = 355666 + 365 * now.getFullYear() + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) + now.getDate() + g_d_m[now.getMonth()]
  let jy = -1595 + 33 * Math.floor(days / 12053)
  days = days - Math.floor(days / 12053) * 12053
  jy += 4 * Math.floor(days / 1461)
  days = days - Math.floor(days / 1461) * 1461
  if (days > 365) {
    jy += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30)
  return { year: jy, month: jm }
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'dashboard',
  setActiveView: (view) => set({ activeView: view }),
  isMobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ isMobileMenuOpen: open }),
  isCommandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  isShortcutsOpen: false,
  setShortcutsOpen: (open) => set({ isShortcutsOpen: open }),
  calendarCursor: defaultCursor(),
  setCalendarCursor: (y, m) => set({ calendarCursor: { year: y, month: m } }),
}))
