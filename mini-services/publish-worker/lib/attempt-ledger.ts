/**
 * MISS-02: PublicationAttempt ledger.
 *
 * Prevents duplicate posts when a worker crashes after the provider
 * accepts a post but before the local DB is updated.
 *
 * Flow:
 *  1. Before provider call: startAttempt (outcome='started')
 *  2. After provider success: markProviderSuccess (outcome='provider_success' + providerPostId)
 *  3. After local DB committed: markLocalSuccess (outcome='local_success')
 *
 * On retry (step 1), findPreviousSuccess checks for a prior
 * 'provider_success' or 'local_success' → if found, skip the provider
 * call and reconcile local state using the stored providerPostId.
 */

import { createHash } from 'crypto'
import { db } from './db'

export function buildFingerprint(
  platformId: string,
  contentId: string,
  attemptNumber: number
): string {
  return createHash('sha256').update(`${platformId}:${contentId}:${attemptNumber}`).digest('hex')
}

export async function findPreviousSuccess(publishJobId: string): Promise<{
  id: string
  providerPostId: string | null
  outcome: string
} | null> {
  return db.publicationAttempt.findFirst({
    where: {
      publishJobId,
      outcome: { in: ['provider_success', 'local_success'] },
    },
    orderBy: { startedAt: 'desc' },
    select: { id: true, providerPostId: true, outcome: true },
  })
}

export async function startAttempt(opts: {
  publishJobId: string
  attemptNumber: number
  requestFingerprint: string
}): Promise<string> {
  const attempt = await db.publicationAttempt.create({
    data: {
      publishJobId: opts.publishJobId,
      attemptNumber: opts.attemptNumber,
      requestFingerprint: opts.requestFingerprint,
      outcome: 'started',
      startedAt: new Date(),
    },
  })
  return attempt.id
}

export async function markProviderSuccess(id: string, providerPostId: string): Promise<void> {
  await db.publicationAttempt.update({
    where: { id },
    data: {
      outcome: 'provider_success',
      providerPostId,
      providerAcknowledgedAt: new Date(),
    },
  })
}

export async function markLocalSuccess(id: string): Promise<void> {
  await db.publicationAttempt.update({
    where: { id },
    data: {
      outcome: 'local_success',
      locallyCommittedAt: new Date(),
      completedAt: new Date(),
    },
  })
}

export async function markFailure(
  id: string,
  opts: {
    outcome: 'retryable_failure' | 'permanent_failure' | 'outcome_unknown'
    errorCategory?: string
    safeUserMessage?: string
  }
): Promise<void> {
  await db.publicationAttempt.update({
    where: { id },
    data: {
      outcome: opts.outcome,
      errorCategory: opts.errorCategory ?? null,
      safeUserMessage: opts.safeUserMessage ?? null,
      completedAt: new Date(),
    },
  })
}
