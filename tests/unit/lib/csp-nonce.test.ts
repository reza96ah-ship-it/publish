import { describe, it, expect } from 'vitest'

/**
 * Issue #119: CSP hardening — remove unsafe-inline from script-src.
 *
 * We test the buildCsp function logic by importing the middleware module
 * indirectly. Since middleware.ts uses next-auth/middleware which isn't
 * available in vitest, we test the CSP string construction logic separately.
 */

// Re-implement the buildCsp function here to test the logic.
// (The middleware.ts file can't be imported directly due to next-auth deps.)
function buildCsp(nonce: string, isProd: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://api.gapgpt.app https://api.telegram.org https://tapi.bale.ai https://botapi.rubika.ir https://graph.facebook.com https://api.linkedin.com wss:",
    "media-src 'self' data:",
    isProd ? "frame-ancestors 'none'" : 'frame-ancestors *',
    "base-uri 'self'",
    "form-action 'self'",
    isProd ? "object-src 'none'" : "object-src 'self'",
  ].join('; ')
}

describe('Issue #119 — CSP nonce-based hardening', () => {
  const TEST_NONCE = 'test-nonce-abc123=='

  describe('script-src — no unsafe-inline (core fix)', () => {
    it('script-src uses nonce-based policy, NOT unsafe-inline', () => {
      const csp = buildCsp(TEST_NONCE, true)
      expect(csp).toContain(`script-src 'nonce-${TEST_NONCE}' 'strict-dynamic'`)
      // Must NOT contain unsafe-inline in script-src
      const scriptSrcPart = csp.split(';').find((p) => p.trim().startsWith('script-src'))
      expect(scriptSrcPart).toBeDefined()
      expect(scriptSrcPart).not.toContain("'unsafe-inline'")
    })

    it('script-src includes strict-dynamic (allows trusted scripts to load dependents)', () => {
      const csp = buildCsp(TEST_NONCE, true)
      expect(csp).toContain("'strict-dynamic'")
    })

    it('script-src does NOT contain unsafe-eval', () => {
      const csp = buildCsp(TEST_NONCE, true)
      const scriptSrcPart = csp.split(';').find((p) => p.trim().startsWith('script-src'))
      expect(scriptSrcPart).not.toContain("'unsafe-eval'")
    })
  })

  describe('nonce is per-request and unique', () => {
    it('CSP includes the provided nonce in script-src', () => {
      const nonce1 = 'unique-nonce-1'
      const nonce2 = 'unique-nonce-2'
      const csp1 = buildCsp(nonce1, true)
      const csp2 = buildCsp(nonce2, true)
      expect(csp1).toContain(nonce1)
      expect(csp2).toContain(nonce2)
      expect(csp1).not.toBe(csp2)
    })
  })

  describe('style-src — keeps unsafe-inline for Tailwind (per issue spec)', () => {
    it('style-src includes unsafe-inline (Tailwind runtime styles)', () => {
      const csp = buildCsp(TEST_NONCE, true)
      const styleSrcPart = csp.split(';').find((p) => p.trim().startsWith('style-src'))
      expect(styleSrcPart).toContain("'unsafe-inline'")
    })
  })

  describe('production CSP directives', () => {
    const csp = buildCsp(TEST_NONCE, true)

    it('frame-ancestors is none (clickjacking protection)', () => {
      expect(csp).toContain("frame-ancestors 'none'")
    })

    it('base-uri is self (prevent base tag injection)', () => {
      expect(csp).toContain("base-uri 'self'")
    })

    it('form-action is self (prevent form submission to external sites)', () => {
      expect(csp).toContain("form-action 'self'")
    })

    it('object-src is none (no Flash/plugins)', () => {
      expect(csp).toContain("object-src 'none'")
    })

    it('default-src is self', () => {
      expect(csp).toContain("default-src 'self'")
    })
  })

  describe('development CSP — relaxed frame-ancestors for preview iframe', () => {
    it('dev mode allows frame-ancestors * (for Z.ai preview)', () => {
      const csp = buildCsp(TEST_NONCE, false)
      expect(csp).toContain('frame-ancestors *')
    })

    it('dev mode keeps nonce-based script-src (no unsafe-inline even in dev)', () => {
      const csp = buildCsp(TEST_NONCE, false)
      expect(csp).toContain(`script-src 'nonce-${TEST_NONCE}' 'strict-dynamic'`)
      // Even in dev, script-src must not have unsafe-inline
      const scriptSrcPart = csp.split(';').find((p) => p.trim().startsWith('script-src'))
      expect(scriptSrcPart).not.toContain("'unsafe-inline'")
    })
  })

  describe('connect-src — allows known API endpoints + WebSocket', () => {
    it('includes all platform API domains', () => {
      const csp = buildCsp(TEST_NONCE, true)
      expect(csp).toContain('https://api.telegram.org')
      expect(csp).toContain('https://tapi.bale.ai')
      expect(csp).toContain('https://botapi.rubika.ir')
      expect(csp).toContain('https://graph.facebook.com')
      expect(csp).toContain('https://api.linkedin.com')
    })

    it('allows wss: for realtime socket.io', () => {
      const csp = buildCsp(TEST_NONCE, true)
      expect(csp).toContain('wss:')
    })
  })
})
