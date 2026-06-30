/**
 * Content aggregate reducer — Next.js app copy. (Issue #147 B)
 *
 * MIRROR of mini-services/publish-worker/lib/state-reducer.ts +
 * the worker's checkContentPublished() in mini-services/publish-worker/index.ts.
 * KEEP IN SYNC — the worker is a separately deployed process and intentionally
 * does not import from src/ (see src/lib/provider-capabilities.ts for the
 * same pattern), so this logic is duplicated rather than shared.
 *
 * Used by API routes that can transition a PublishJob to a terminal state
 * outside the worker process (e.g. the cancel action in
 * src/app/api/publish-jobs/[id]/route.ts) so the parent Content's aggregate
 * status is recomputed immediately, not just when the worker happens to run.
 */

import { db } from './db'

export type JobStatus =
  | 'pending'
  | 'queued'
  | 'processing'
  | 'publishing'
  | 'success'
  | 'failed'
  | 'action'
  | 'cancelled'
  | 'scheduled'

export type ContentStatus =
  | 'draft'
  | 'review'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'partially_published'
  | 'failed'
  | 'action_required'
  | 'cancelled'

const ACTIVE_STATUSES = new Set<JobStatus>([
  'pending',
  'queued',
  'processing',
  'publishing',
  'scheduled',
])

export function deriveContentStatus(jobStatuses: JobStatus[]): {
  status: ContentStatus
  markPublishedAt: boolean
} {
  if (jobStatuses.length === 0) {
    return { status: 'failed', markPublishedAt: false }
  }

  const all = (pred: (s: JobStatus) => boolean) => jobStatuses.every(pred)
  const any = (pred: (s: JobStatus) => boolean) => jobStatuses.some(pred)

  if (all((s) => s === 'cancelled')) {
    return { status: 'cancelled', markPublishedAt: false }
  }
  if (all((s) => s === 'success')) {
    return { status: 'published', markPublishedAt: true }
  }
  if (all((s) => s === 'failed')) {
    return { status: 'failed', markPublishedAt: false }
  }
  if (any((s) => s === 'action')) {
    return { status: 'action_required', markPublishedAt: false }
  }
  if (any((s) => ACTIVE_STATUSES.has(s))) {
    return { status: 'publishing', markPublishedAt: false }
  }
  const hasSuccess = any((s) => s === 'success')
  const hasFailed = any((s) => s === 'failed')
  if (hasSuccess && hasFailed) {
    return { status: 'partially_published', markPublishedAt: false }
  }
  if (hasSuccess) {
    return { status: 'published', markPublishedAt: true }
  }
  return { status: 'failed', markPublishedAt: false }
}

const TERMINAL_OR_ACTIVE = new Set<ContentStatus>([
  'published',
  'partially_published',
  'failed',
  'action_required',
  'cancelled',
  'publishing',
])

/**
 * Recompute and persist the parent Content's aggregate status from the
 * current state of all its PublishJobs. Issue #147 B: must be called after
 * EVERY terminal PublishJob transition — success, permanent failure,
 * action-required, exhausted retries, cancellation, outcome-unknown — not
 * just on success. Safe to call redundantly (idempotent recompute).
 */
export async function checkContentPublished(contentId: string): Promise<void> {
  const jobs = await db.publishJob.findMany({
    where: { contentId },
    select: { status: true },
  })
  if (jobs.length === 0) return

  const statuses = jobs.map((j) => j.status as JobStatus)
  const { status, markPublishedAt } = deriveContentStatus(statuses)

  if (TERMINAL_OR_ACTIVE.has(status)) {
    await db.content.update({
      where: { id: contentId },
      data: {
        status,
        ...(markPublishedAt ? { publishedAt: new Date() } : {}),
      },
    })
  }
}
