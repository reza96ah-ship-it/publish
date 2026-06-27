import { describe, it, expect, beforeEach } from 'vitest'
import { useAppStore } from '../../../src/lib/store'

describe('God-node: useAppStore (Zustand)', () => {
  beforeEach(() => {
    // Reset store to defaults before each test
    useAppStore.setState({
      isMobileMenuOpen: false,
      isCommandPaletteOpen: false,
      isShortcutsOpen: false,
    })
  })

  describe('isMobileMenuOpen', () => {
    it('defaults to false', () => {
      expect(useAppStore.getState().isMobileMenuOpen).toBe(false)
    })

    it('setMobileMenuOpen(true) opens menu', () => {
      useAppStore.getState().setMobileMenuOpen(true)
      expect(useAppStore.getState().isMobileMenuOpen).toBe(true)
    })

    it('setMobileMenuOpen(false) closes menu', () => {
      useAppStore.getState().setMobileMenuOpen(true)
      useAppStore.getState().setMobileMenuOpen(false)
      expect(useAppStore.getState().isMobileMenuOpen).toBe(false)
    })
  })

  describe('isCommandPaletteOpen', () => {
    it('defaults to false', () => {
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(false)
    })

    it('setCommandPaletteOpen toggles state', () => {
      useAppStore.getState().setCommandPaletteOpen(true)
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(true)
      useAppStore.getState().setCommandPaletteOpen(false)
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(false)
    })
  })

  describe('isShortcutsOpen', () => {
    it('defaults to false', () => {
      expect(useAppStore.getState().isShortcutsOpen).toBe(false)
    })

    it('setShortcutsOpen toggles state', () => {
      useAppStore.getState().setShortcutsOpen(true)
      expect(useAppStore.getState().isShortcutsOpen).toBe(true)
    })
  })

  describe('calendarCursor', () => {
    it('initializes with current Jalali month', () => {
      const cursor = useAppStore.getState().calendarCursor
      expect(cursor.year).toBeGreaterThan(1400)
      expect(cursor.month).toBeGreaterThanOrEqual(1)
      expect(cursor.month).toBeLessThanOrEqual(12)
    })

    it('setCalendarCursor updates year + month', () => {
      useAppStore.getState().setCalendarCursor(1404, 7)
      expect(useAppStore.getState().calendarCursor).toEqual({ year: 1404, month: 7 })
    })

    it('setCalendarCursor overwrites previous cursor', () => {
      useAppStore.getState().setCalendarCursor(1404, 1)
      useAppStore.getState().setCalendarCursor(1403, 12)
      expect(useAppStore.getState().calendarCursor).toEqual({ year: 1403, month: 12 })
    })
  })

  describe('store independence', () => {
    it('state changes do not affect other state keys', () => {
      useAppStore.getState().setMobileMenuOpen(true)
      useAppStore.getState().setCommandPaletteOpen(true)
      expect(useAppStore.getState().isShortcutsOpen).toBe(false)

      useAppStore.getState().setShortcutsOpen(true)
      expect(useAppStore.getState().isMobileMenuOpen).toBe(true)
      expect(useAppStore.getState().isCommandPaletteOpen).toBe(true)
    })
  })
})
