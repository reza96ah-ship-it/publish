/**
 * Issue #149 (gap #3 + #4): Reconciliation scanner.
 *
 * `ChannelAdapter.reconcile()` existed as an interface method but nothing
 * ever called it — `recordReconciliation()` in attempt-ledger.ts was dead
 * code, and Publications stuck at `reconciliationStatus: 'still_unknown'`
 * (set by the worker's `outcome_unknown` branch in index.ts) had no path
 * back to a resolved state other than a human manually calling
 * POST /api/publications/[id]/resolve.
 *
 * This scanner runs periodically (mirrors lib/token-expiry-scanner.ts):
 *   1. Finds Publications with reconciliationStatus = 'still_unknown'.
 *   2. If the adapter for that platform implements reconcile(), calls it.
 *   3. Records the outcome in the PublicationAttempt ledger
 *      (recordReconciliation) AND updates Publication.reconciliationStatus
 *      so the retry-block check in index.ts (findUnresolvedUnknown +
 *      Publication.reconciliationStatus) sees the resolution.
 *   4. If the adapter has no reconcile() (LinkedIn, Instagram, Bale, Rubika,
 *      Eitaa — see per-adapter comments for why), the Publication is left at
 *      'still_unknown' — it can only be resolved by a human via the manual
 *      resolution endpoint. This is the documented, intentional fallback for
 *      providers without a reconciliation mechanism (issue #149's acceptance
 *      criteria: "Manual resolution workflow for providers without
 *      reconciliation").
 *
 * A confirmed_success outcome also updates the Publication's own status
 * fields (providerPostId, status: 'published') so the UI reflects the
 * corrected state — mirroring what the worker's main success path does.
 */

import { db } from './db'
import { getAdapter } from '../adapters'
import { decrypt } from './crypto'
import { recordReconciliation } from './attempt-ledger'
import type { AdapterAccount, PlatformType } from '../adapters/types'

const SCAN_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes
// Give a fresh outcome_unknown a grace period before the first reconcile
// attempt — an in-flight provider response might still land normally.
const MIN_AGE_BEFORE_RECONCILE_MS = 2 * 60 * 1000

let scanTimer: ReturnType<typeof setInterval> | null = null

export function startReconciliationScanner(): void {
  if (scanTimer) return
  setTimeout(() => {
    scanUnresolvedPublications().catch((err) =>
      console.error('[reconcile-scanner] initial scan failed:', err)
    )
  }, 15_000)
  scanTimer = setInterval(() => {
    scanUnresolvedPublications().catch((err) =>
      console.error('[reconcile-scanner] scheduled scan failed:', err)
    )
  }, SCAN_INTERVAL_MS)
  console.log('[reconcile-scanner] started — scans every 10min for outcome_unknown publications')
}

export function stopReconciliationScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
    console.log('[reconcile-scanner] stopped')
  }
}

/**
 * Scan Publications stuck at reconciliationStatus='still_unknown' and try to
 * resolve them via the adapter's reconcile() where one exists.
 * Exported for unit testing.
 */
export async function scanUnresolvedPublications(now: Date = new Date()): Promise<{
  scanned: number
  confirmedSuccess: number
  confirmedFailure: number
  stillUnknown: number
  noReconcileSupport: number
}> {
  const result = {
    scanned: 0,
    confirmedSuccess: 0,
    confirmedFailure: 0,
    stillUnknown: 0,
    noReconcileSupport: 0,
  }

  const publications = await (db as any).publication.findMany({
    where: {
      reconciliationStatus: 'still_unknown',
      updatedAt: { lte: new Date(now.getTime() - MIN_AGE_BEFORE_RECONCILE_MS) },
    },
    include: {
      platform: true,
      content: true,
      revision: true,
    },
    take: 100,
  })

  for (const publication of publications) {
    result.scanned++
    const adapter = getAdapter(publication.platform.type)

    if (!adapter?.reconcile) {
      // Issue #149: providers without a reconciliation mechanism stay
      // 'still_unknown' — resolved only via the manual /resolve endpoint.
      // This is intentional, not a gap: see per-adapter header comments for
      // the documented reason each provider lacks one.
      result.noReconcileSupport++
      continue
    }

    const account: AdapterAccount = {
      id: publication.platform.id,
      type: publication.platform.type as PlatformType,
      username: publication.platform.username,
      status: publication.platform.status,
      circuitState: publication.platform.circuitState as 'closed' | 'open' | 'half_open',
      token: publication.platform.tokenSecret ? decrypt(publication.platform.tokenSecret) : undefined,
      targetId: publication.platform.targetId ?? undefined,
    }

    let outcome
    try {
      outcome = await adapter.reconcile({
        publicationOperationId: publication.publicationOperationId ?? undefined,
        providerPostId: publication.providerPostId ?? undefined,
        account,
        content: {
          id: publication.content.id,
          title: publication.revision?.title ?? publication.content.title,
          body: publication.revision?.body ?? publication.content.body,
          hashtags: publication.revision?.hashtags ?? publication.content.hashtags,
          thumbnailUrl: publication.content.thumbnailUrl,
        },
      })
    } catch (err) {
      console.error(`[reconcile-scanner] adapter.reconcile() threw for publication ${publication.id}:`, err)
      result.stillUnknown++
      continue
    }

    const reconciliationResult =
      outcome.kind === 'confirmed_success'
        ? 'confirmed_success'
        : outcome.kind === 'confirmed_failure'
          ? 'confirmed_failure'
          : 'still_unknown'

    // Issue #149: append the reconciliation attempt to the ledger — this is
    // what makes findUnresolvedUnknown() in attempt-ledger.ts see the
    // resolution (it reads the LATEST PublicationAttempt row per fingerprint).
    await recordReconciliation({
      publishJobId: publication.publishJobId ?? publication.id,
      publicationId: publication.id,
      requestFingerprint: publication.requestFingerprint ?? '',
      reconciliationResult,
      providerPostId: outcome.kind === 'confirmed_success' ? outcome.providerPostId : undefined,
      reason: outcome.kind === 'confirmed_failure' ? outcome.reason : undefined,
    })

    if (reconciliationResult === 'confirmed_success') {
      result.confirmedSuccess++
      await (db as any).publication.update({
        where: { id: publication.id },
        data: {
          status: 'published',
          providerPostId: outcome.kind === 'confirmed_success' ? outcome.providerPostId : publication.providerPostId,
          providerAcknowledgedAt: now,
          reconciliationStatus: 'confirmed_success',
          completedAt: now,
        },
      })
      console.log(`[reconcile-scanner] publication ${publication.id} — confirmed_success via adapter.reconcile()`)
    } else if (reconciliationResult === 'confirmed_failure') {
      result.confirmedFailure++
      await (db as any).publication.update({
        where: { id: publication.id },
        data: {
          status: 'failed',
          reconciliationStatus: 'confirmed_failure',
          errorMessage: outcome.kind === 'confirmed_failure' ? outcome.reason : publication.errorMessage,
          completedAt: now,
        },
      })
      console.log(`[reconcile-scanner] publication ${publication.id} — confirmed_failure via adapter.reconcile()`)
    } else {
      result.stillUnknown++
      // Leave reconciliationStatus = 'still_unknown' — will be retried next scan
      // (or resolved manually). updatedAt bumps automatically via Prisma @updatedAt
      // only on an actual write, so touch a no-op-ish field to space out reconcile
      // attempts instead of hammering the provider every 10 minutes indefinitely.
      await (db as any).publication.update({
        where: { id: publication.id },
        data: { reconciliationStatus: 'still_unknown' },
      })
    }
  }

  if (result.scanned > 0) {
    console.log(
      `[reconcile-scanner] scan complete — scanned:${result.scanned} success:${result.confirmedSuccess} failure:${result.confirmedFailure} unknown:${result.stillUnknown} unsupported:${result.noReconcileSupport}`
    )
  }

  return result
}
