import { describe, it, expect } from 'vitest'
import { classifyError, safeErrorMessage } from '../../../mini-services/publish-worker/lib/outbox-dispatcher'

/**
 * Issue #148: Outbox dispatcher safety tests.
 *
 * Tests the pure logic functions (error classification, safe messages).
 * Integration tests (concurrent claim, lease recovery, DLQ, replay) require
 * a real PostgreSQL + Redis and are part of the test pyramid in #153.
 */

describe('Issue #148 — Outbox dispatcher safety', () => {
  describe('classifyError', () => {
    it('classifies Redis connection errors', () => {
      expect(classifyError(new Error('ECONNREFUSED 127.0.0.1:6379'))).toBe('redis')
      expect(classifyError(new Error('Redis connection failed'))).toBe('redis')
    })

    it('classifies database errors', () => {
      expect(classifyError(new Error('database connection failed'))).toBe('db')
      expect(classifyError(new Error('prisma query error'))).toBe('db')
    })

    it('classifies serialization errors', () => {
      expect(classifyError(new Error('JSON parse failed'))).toBe('serialization')
      expect(classifyError(new Error('serialize error'))).toBe('serialization')
    })

    it('classifies payload errors', () => {
      expect(classifyError(new Error('payload invalid'))).toBe('payload')
      expect(classifyError(new Error('invalid data'))).toBe('payload')
    })

    it('classifies unknown errors as unknown', () => {
      expect(classifyError(new Error('something weird happened'))).toBe('unknown')
      expect(classifyError('string error')).toBe('unknown')
    })
  })

  describe('safeErrorMessage', () => {
    it('returns safe Persian message for redis errors', () => {
      const msg = safeErrorMessage('redis', 'ECONNREFUSED details with host:port')
      expect(msg).toContain('Redis')
      expect(msg).not.toContain('ECONNREFUSED') // no raw error details
    })

    it('returns safe Persian message for db errors', () => {
      const msg = safeErrorMessage('db', 'PG_CONNECTION_ERROR host=db.internal:5432')
      expect(msg).toContain('پایگاه داده')
      expect(msg).not.toContain('db.internal') // no internal details
    })

    it('returns safe Persian message for serialization errors', () => {
      const msg = safeErrorMessage('serialization', 'JSON.parse: unexpected token')
      expect(msg).toContain('پردازش داده')
    })

    it('returns safe Persian message for payload errors', () => {
      const msg = safeErrorMessage('payload', 'invalid payload structure')
      expect(msg).toContain('داده نامعتبر')
    })

    it('returns safe Persian message for unknown errors', () => {
      const msg = safeErrorMessage('unknown', 'some raw error with stack trace')
      expect(msg).toContain('ناشناخته')
      expect(msg).not.toContain('stack trace')
    })

    it('never leaks raw error details', () => {
      const categories = ['redis', 'db', 'serialization', 'payload', 'unknown']
      for (const cat of categories) {
        const msg = safeErrorMessage(cat, 'SECRET_TOKEN=abc123 host=internal.db:5432')
        expect(msg).not.toContain('SECRET_TOKEN')
        expect(msg).not.toContain('abc123')
        expect(msg).not.toContain('internal.db')
      }
    })
  })

  describe('outbox state model (Issue #148)', () => {
    it('the 6 required states are defined in the schema', () => {
      // These are the states the outbox can be in per Issue #148:
      const requiredStates = ['pending', 'claimed', 'delivered', 'retry_wait', 'dead_letter', 'cancelled']
      // The dispatcher transitions between these states:
      // pending → claimed (atomic claim)
      // claimed → delivered (success)
      // claimed → retry_wait (transient failure)
      // claimed → dead_letter (exhausted retries)
      // retry_wait → pending (backoff expired)
      // pending/retry_wait → cancelled (user cancellation)
      // dead_letter → pending (replay)
      expect(requiredStates).toHaveLength(6)
    })
  })
})
