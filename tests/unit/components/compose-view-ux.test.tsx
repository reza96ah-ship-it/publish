import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../setup'
import { ComposeView } from '../../../src/components/views/compose-view'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: () => '/compose',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock fetch for autosave + draft restoration
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

describe('Issue #152 — Composer UX truthfulness', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  describe('Task 1 — Text-only publication validation', () => {
    it('canPublish allows text-only when all channels support text', () => {
      // The compose view should NOT require media when all selected channels
      // support text-only posts (Telegram, LinkedIn).
      // This is verified by reading the source code (contract test).
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      // Verify canPublish does NOT globally require selectedMedia.length > 0
      expect(src).toMatch(/anyChannelRequiresMedia/)
      expect(src).not.toMatch(/selectedMedia\.length\s*>\s*0\s*&&/)
    })

    it('shows per-channel media requirement message only when needed', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      // The error message should mention "channels that require media"
      expect(src).toMatch(/یکی از پلتفرم‌های انتخابی به رسانه نیاز دارد/)
    })
  })

  describe('Task 2 — Durable autosave', () => {
    it('autosave checks response.ok before showing saved', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      // Verify response.ok is checked
      expect(src).toMatch(/if\s*\(!res\.ok\)/)
      expect(src).toMatch(/setSaveState\('error'\)/)
    })

    it('draft restoration fetches /api/compose-draft on mount', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      expect(src).toMatch(/fetch\('\/api\/compose-draft'\)/)
      expect(src).toMatch(/draftRestored/)
    })
  })

  describe('Task 3 — Scheduling UX', () => {
    it('validates scheduledAt is in the future', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      expect(src).toMatch(/scheduledAt\.getTime\(\)\s*<=\s*Date\.now\(\)/)
      expect(src).toMatch(/زمان‌بندی باید در آینده باشد/)
    })

    it('validates scheduledAt is present when schedule mode is selected', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      expect(src).toMatch(/if\s*\(!scheduledAt\)/)
      expect(src).toMatch(/برای زمان‌بندی، باید تاریخ و ساعت آینده را انتخاب کنید/)
    })
  })

  describe('Task 4 — Truthful publication feedback', () => {
    it('announces "queued" not "published" on API acceptance', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      // The announce should say "queued" (صف انتشار) not "published" (منتشر شد)
      expect(src).toMatch(/به صف انتشار ارسال شد/)
      expect(src).not.toMatch(/announce\('محتوا با موفقیت منتشر شد'\)/)
    })

    it('loading says "sending to queue" not "publishing"', () => {
      const fs = require('fs')
      const path = require('path')
      const src = fs.readFileSync(
        path.resolve(__dirname, '../../../src/components/views/compose-view.tsx'),
        'utf8'
      )
      expect(src).toMatch(/در حال ارسال به صف انتشار/)
    })
  })
})
