import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Issue #144: Provider auth adapter tests.
 *
 * Tests the adapter contract: validateBotToken for bot-token providers,
 * validateCredential for OAuth providers. Uses mocked fetch to simulate
 * provider API responses.
 */

import { TelegramAuthAdapter } from '../../../src/lib/provider-auth/bot-token-adapters'
import { computeCredentialStatus, REQUIRED_SCOPES } from '../../../src/lib/provider-auth/types'

// Set up env for crypto
process.env.AUTH_SECRET = 'test-secret-for-crypto'

describe('Issue #144 — Provider auth adapters', () => {
  describe('TelegramAuthAdapter.validateBotToken', () => {
    let adapter: TelegramAuthAdapter
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      adapter = new TelegramAuthAdapter()
      fetchMock = vi.fn()
      global.fetch = fetchMock as any
    })

    it('returns valid=true when getMe succeeds and target is accessible', async () => {
      // Mock getMe → ok
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { id: 123456, username: 'test_bot', first_name: 'Test Bot' },
        }),
      })
      // Mock getChat → ok (target exists)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { id: -100123, title: 'Test Channel' } }),
      })
      // Mock getChatMember → administrator
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { status: 'administrator' },
        }),
      })

      const result = await adapter.validateBotToken({
        token: '123:ABC',
        targetId: '@testchannel',
      })

      expect(result.valid).toBe(true)
      expect(result.health.status).toBe('active')
      expect(result.health.canPublish).toBe(true)
      expect(result.botInfo?.username).toBe('test_bot')
    })

    it('returns valid=false when token is invalid (getMe fails)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          description: 'Unauthorized',
        }),
      })

      const result = await adapter.validateBotToken({ token: 'invalid:token' })

      expect(result.valid).toBe(false)
      expect(result.health.status).toBe('invalid')
      expect(result.health.canPublish).toBe(false)
    })

    it('returns valid=false when bot is not admin in the target channel', async () => {
      // getMe → ok
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { id: 123, username: 'bot', first_name: 'Bot' },
        }),
      })
      // getChat → ok
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { id: -100, title: 'Channel' } }),
      })
      // getChatMember → member (not admin)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { status: 'member' },
        }),
      })

      const result = await adapter.validateBotToken({
        token: '123:ABC',
        targetId: '@channel',
      })

      expect(result.valid).toBe(false)
      expect(result.health.status).toBe('invalid')
      expect(result.health.message).toContain('مدیر')
    })

    it('returns valid=false when target channel does not exist', async () => {
      // getMe → ok
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { id: 123, username: 'bot', first_name: 'Bot' },
        }),
      })
      // getChat → error (channel not found)
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: false,
          description: 'Chat not found',
        }),
      })

      const result = await adapter.validateBotToken({
        token: '123:ABC',
        targetId: '@nonexistent',
      })

      expect(result.valid).toBe(false)
      expect(result.health.status).toBe('error')
      expect(result.health.message).toContain('مقصد')
    })

    it('returns valid=false on network error (unreachable provider)', async () => {
      fetchMock.mockRejectedValueOnce(new Error('Network error'))

      const result = await adapter.validateBotToken({ token: '123:ABC' })

      expect(result.valid).toBe(false)
      expect(result.health.status).toBe('error')
      expect(result.health.message).toContain('شبکه')
    })

    it('bot tokens have null expiry (do not expire)', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          result: { id: 123, username: 'bot', first_name: 'Bot' },
        }),
      })

      const result = await adapter.validateBotToken({ token: '123:ABC' })

      expect(result.valid).toBe(true)
      expect(result.credential?.expiresAt).toBeNull()
    })
  })

  describe('REQUIRED_SCOPES', () => {
    it('Instagram requires 3 scopes', () => {
      expect(REQUIRED_SCOPES.instagram).toHaveLength(3)
      expect(REQUIRED_SCOPES.instagram).toContain('instagram_content_publish')
    })

    it('LinkedIn requires w_member_social for posting', () => {
      expect(REQUIRED_SCOPES.linkedin).toContain('w_member_social')
    })

    it('Bot-token providers have empty required scopes', () => {
      expect(REQUIRED_SCOPES.telegram).toEqual([])
      expect(REQUIRED_SCOPES.bale).toEqual([])
      expect(REQUIRED_SCOPES.rubika).toEqual([])
    })
  })

  describe('computeCredentialStatus', () => {
    it('returns "active" when expiry is far in the future', () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      expect(computeCredentialStatus({ status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() }, future)).toBe('active')
    })

    it('returns "expiring" when expiry is within 7 days', () => {
      const soon = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days
      expect(computeCredentialStatus({ status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() }, soon)).toBe('expiring')
    })

    it('returns "expired" when expiry has passed', () => {
      const past = new Date(Date.now() - 60000)
      expect(computeCredentialStatus({ status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() }, past)).toBe('expired')
    })

    it('returns "active" when expiry is null (bot tokens)', () => {
      expect(computeCredentialStatus({ status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() }, null)).toBe('active')
    })

    it('returns "revoked" when health status is revoked (overrides expiry)', () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      expect(computeCredentialStatus({ status: 'revoked', canPublish: false, message: '', missingScopes: [], validatedAt: new Date() }, future)).toBe('revoked')
    })

    it('returns "invalid" when health status is invalid (overrides expiry)', () => {
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      expect(computeCredentialStatus({ status: 'invalid', canPublish: false, message: '', missingScopes: [], validatedAt: new Date() }, future)).toBe('invalid')
    })
  })
})
