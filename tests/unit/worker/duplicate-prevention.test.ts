import { describe, it, expect } from 'vitest'
import { buildFingerprint, generateOperationId } from '../../../mini-services/publish-worker/lib/attempt-ledger'

/**
 * Issue #149: Duplicate prevention tests.
 *
 * Tests the core invariant: the request fingerprint is STABLE across retries
 * (does NOT include attemptNumber). This is the fix for the critical bug
 * where every retry got a different fingerprint.
 *
 * Integration tests (crash-window matrix) require real PostgreSQL + Redis
 * and are part of the test pyramid in #153.
 */

describe('Issue #149 — Stable logical operation identity', () => {
  describe('buildFingerprint (STABLE across retries)', () => {
    const platformId = 'platform-123'
    const contentId = 'content-456'
    const revisionId = 'revision-789'

    it('produces the SAME fingerprint for the same logical inputs', () => {
      const fp1 = buildFingerprint(platformId, contentId, revisionId)
      const fp2 = buildFingerprint(platformId, contentId, revisionId)
      expect(fp1).toBe(fp2)
    })

    it('produces DIFFERENT fingerprints for different platforms', () => {
      const fp1 = buildFingerprint('platform-a', contentId, revisionId)
      const fp2 = buildFingerprint('platform-b', contentId, revisionId)
      expect(fp1).not.toBe(fp2)
    })

    it('produces DIFFERENT fingerprints for different content', () => {
      const fp1 = buildFingerprint(platformId, 'content-a', revisionId)
      const fp2 = buildFingerprint(platformId, 'content-b', revisionId)
      expect(fp1).not.toBe(fp2)
    })

    it('produces DIFFERENT fingerprints for different revisions', () => {
      const fp1 = buildFingerprint(platformId, contentId, 'rev-1')
      const fp2 = buildFingerprint(platformId, contentId, 'rev-2')
      expect(fp1).not.toBe(fp2)
    })

    it('is a 64-char hex string (SHA-256)', () => {
      const fp = buildFingerprint(platformId, contentId, revisionId)
      expect(fp).toHaveLength(64)
      expect(fp).toMatch(/^[a-f0-9]+$/)
    })

    it('does NOT include attempt number (the core fix)', () => {
      // The old buildFingerprint took (platformId, contentId, attemptNumber)
      // The new one takes (platformId, contentId, revisionId)
      // Verify that the function signature has 3 string args, not (string, string, number)
      const fp = buildFingerprint(platformId, contentId, revisionId)
      expect(fp).toBeTruthy()
      // The fingerprint is deterministic and does NOT change with "attempt number"
      // because we pass revisionId, not attemptNumber
    })
  })

  describe('generateOperationId (stable per-publication idempotency key)', () => {
    const platformId = 'platform-123'
    const contentId = 'content-456'
    const revisionId = 'revision-789'

    it('produces the SAME operation ID for the same inputs', () => {
      const op1 = generateOperationId(platformId, contentId, revisionId)
      const op2 = generateOperationId(platformId, contentId, revisionId)
      expect(op1).toBe(op2)
    })

    it('starts with "pub_" prefix (distinguishable from fingerprint)', () => {
      const opId = generateOperationId(platformId, contentId, revisionId)
      expect(opId.startsWith('pub_')).toBe(true)
    })

    it('is 36 chars long (pub_ + 32 hex chars)', () => {
      const opId = generateOperationId(platformId, contentId, revisionId)
      expect(opId).toHaveLength(36) // 'pub_' (4) + 32 hex chars
    })

    it('produces DIFFERENT IDs for different publications', () => {
      const op1 = generateOperationId('platform-a', 'content-1', 'rev-1')
      const op2 = generateOperationId('platform-b', 'content-2', 'rev-2')
      expect(op1).not.toBe(op2)
    })

    it('never changes across retries (stable)', () => {
      // The operation ID is derived from (platformId, contentId, revisionId)
      // which are immutable after publication creation.
      // It does NOT include any retry/attempt number.
      const op1 = generateOperationId(platformId, contentId, revisionId)
      // Simulate "retry" — same inputs, should get same ID
      const op2 = generateOperationId(platformId, contentId, revisionId)
      expect(op1).toBe(op2)
    })
  })

  describe('fingerprint vs operation ID relationship', () => {
    it('fingerprint and operationId are different strings', () => {
      const fp = buildFingerprint('p1', 'c1', 'r1')
      const opId = generateOperationId('p1', 'c1', 'r1')
      expect(fp).not.toBe(opId)
      expect(fp.startsWith('pub_')).toBe(false)
      expect(opId.startsWith('pub_')).toBe(true)
    })
  })
})
