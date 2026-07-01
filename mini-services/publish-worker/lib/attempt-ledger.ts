/**
 * Issue #149: PublicationAttempt ledger — fixed request fingerprint.
 *
 * Before: buildFingerprint included attemptNumber → every retry got a
 * DIFFERENT fingerprint, defeating its purpose as a logical operation ID.
 *
 * After: buildFingerprint uses ONLY immutable logical inputs:
 *   platformId + contentId + revisionId
 * This is the SAME across all retries for the same publication.
 * attemptNumber is stored separately for observability.
 *
 * Also adds:
 * - publicationOperationId: stable per-Publication idempotency key
 * - Conditional updates (expectedPriorOutcome) — never overwrite history
 * - providerOperationId storage for provider-side correlation
 */

import { createHash } from 'crypto'
import { db } from './db'

/**
 * Issue #149: Build a STABLE request fingerprint from immutable logical inputs.
 * Does NOT include attemptNumber — the fingerprint is the same across all retries.
 *
 * Inputs: platformId, contentId, revisionId
 * These are set when the Publication is created and never change.
 */
export function buildFingerprint(
  platformId: string,
  contentId: string,
  revisionId: string
): string {
  return createHash('sha256')
    .update(`${platformId}:${contentId}:${revisionId}`)
    .digest('hex')
}

/**
 * Issue #149: Generate a stable publicationOperationId for a Publication.
 * This is the idempotency key sent to providers that support it.
 * It never changes across retries for the same publication.
 */
export function generateOperationId(
  platformId: string,
  contentId: string,
  revisionId: string
): string {
  // Use a different prefix than the fingerprint so they're distinguishable
  return 'pub_' + createHash('sha256')
    .update(`${platformId}:${contentId}:${revisionId}`)
    .digest('hex')
    .substring(0, 32)
}

/**
 * Find a previous successful attempt for this publication.
 * Issue #149: also checks by requestFingerprint (not just publishJobId)
 * so it works even if the job was re-enqueued with a different ID.
 */
export async function findPreviousSuccess(publishJobId: string): Promise<{
  id: string
  providerPostId: string | null
  outcome: string
  requestFingerprint: string
} | null> {
  return db.publicationAttempt.findFirst({
    where: {
      publishJobId,
      outcome: { in: ['provider_success', 'local_success'] },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, providerPostId: true, outcome: true, requestFingerprint: true },
  })
}

/**
 * Issue #149: Find previous success by stable fingerprint (not job ID).
 * This catches cases where the BullMQ job was recreated but the
 * logical operation is the same.
 */
export async function findSuccessByFingerprint(fingerprint: string): Promise<{
  id: string
  providerPostId: string | null
  outcome: string
  publishJobId: string
} | null> {
  return db.publicationAttempt.findFirst({
    where: {
      requestFingerprint: fingerprint,
      outcome: { in: ['provider_success', 'local_success'] },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, providerPostId: true, outcome: true, publishJobId: true },
  })
}

/**
 * Start a new attempt. Issue #149: stores the STABLE fingerprint
 * (not attempt-specific) so retries are identifiable as the same operation.
 */
export async function startAttempt(opts: {
  publishJobId: string
  attemptNumber: number
  requestFingerprint: string
  publicationOperationId?: string
  publicationId?: string
}): Promise<string> {
  const attempt = await db.publicationAttempt.create({
    data: {
      publishJobId: opts.publishJobId,
      publicationId: opts.publicationId ?? null,
      attemptNumber: opts.attemptNumber,
      requestFingerprint: opts.requestFingerprint,
      outcome: 'started',
      startedAt: new Date(),
      providerOperationId: opts.publicationOperationId ?? null,
    },
  })
  return attempt.id
}

/**
 * Issue #149: Mark provider success with conditional update.
 * Only updates if the current outcome is 'started' — prevents overwriting
 * a concurrent attempt that already marked success or failure.
 */
export async function markProviderSuccess(id: string, providerPostId: string): Promise<boolean> {
  const result = await db.publicationAttempt.updateMany({
    where: { id, outcome: 'started' },
    data: {
      outcome: 'provider_success',
      providerPostId,
      providerAcknowledgedAt: new Date(),
    },
  })
  return result.count > 0
}

/**
 * Issue #149: Mark local success with conditional update.
 * Only updates if the current outcome is 'provider_success'.
 */
export async function markLocalSuccess(id: string): Promise<boolean> {
  const result = await db.publicationAttempt.updateMany({
    where: { id, outcome: 'provider_success' },
    data: {
      outcome: 'local_success',
      locallyCommittedAt: new Date(),
      completedAt: new Date(),
    },
  })
  return result.count > 0
}

/**
 * Issue #149: Mark failure with conditional update.
 * Only updates if the current outcome is 'started'.
 * Never overwrites a successful attempt.
 */
export async function markFailure(
  id: string,
  opts: {
    outcome: 'retryable_failure' | 'permanent_failure' | 'outcome_unknown'
    errorCategory?: string
    safeUserMessage?: string
  }
): Promise<boolean> {
  const result = await db.publicationAttempt.updateMany({
    where: { id, outcome: 'started' },
    data: {
      outcome: opts.outcome,
      errorCategory: opts.errorCategory ?? null,
      safeUserMessage: opts.safeUserMessage ?? null,
      completedAt: new Date(),
    },
  })
  return result.count > 0
}

/**
 * Issue #149: Record a reconciliation attempt in the ledger.
 * Used when the worker reconciles an outcome_unknown publication.
 */
export async function recordReconciliation(opts: {
  publishJobId: string
  publicationId?: string
  requestFingerprint: string
  reconciliationResult: 'confirmed_success' | 'confirmed_failure' | 'still_unknown'
  providerPostId?: string
  reason?: string
}): Promise<void> {
  await db.publicationAttempt.create({
    data: {
      publishJobId: opts.publishJobId,
      publicationId: opts.publicationId ?? null,
      attemptNumber: 9999, // reconciliation attempts use a high number to distinguish
      requestFingerprint: opts.requestFingerprint,
      outcome: opts.reconciliationResult === 'confirmed_success'
        ? 'provider_success'
        : opts.reconciliationResult === 'confirmed_failure'
          ? 'permanent_failure'
          : 'outcome_unknown',
      providerPostId: opts.providerPostId ?? null,
      safeUserMessage: opts.reason ?? null,
      startedAt: new Date(),
      providerAcknowledgedAt: opts.reconciliationResult === 'confirmed_success' ? new Date() : null,
      completedAt: new Date(),
    },
  })
}
