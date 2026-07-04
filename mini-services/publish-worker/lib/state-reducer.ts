/**
 * MISS-06: Publication aggregate reducer.
 *
 * Derives the canonical content status from the current state of all its
 * publish jobs. Called by the worker after every job status transition so
 * the Content row always reflects the true aggregate outcome.
 *
 * Rules applied in priority order:
 *  1. All cancelled             → cancelled
 *  2. All published             → published  (+ sets publishedAt)
 *  3. All failed                → failed
 *  4. Any action_required       → action_required
 *  5. Any active job            → publishing
 *  6. Mix of published + failed → partially_published
 *  7. Any published             → published
 *  8. Otherwise                 → failed
 */

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

  // Rule 1: all cancelled
  if (all((s) => s === 'cancelled')) {
    return { status: 'cancelled', markPublishedAt: false }
  }

  // Rule 2: all published (success)
  if (all((s) => s === 'success')) {
    return { status: 'published', markPublishedAt: true }
  }

  // Rule 3: all failed
  if (all((s) => s === 'failed')) {
    return { status: 'failed', markPublishedAt: false }
  }

  // Rule 4: any action_required (auth error, needs manual fix)
  if (any((s) => s === 'action')) {
    return { status: 'action_required', markPublishedAt: false }
  }

  // Rule 5: any active job still in flight
  if (any((s) => ACTIVE_STATUSES.has(s))) {
    return { status: 'publishing', markPublishedAt: false }
  }

  // Rule 6: mix of published + failed (partial success)
  const hasSuccess = any((s) => s === 'success')
  const hasFailed = any((s) => s === 'failed')
  if (hasSuccess && hasFailed) {
    return { status: 'partially_published', markPublishedAt: false }
  }

  // Rule 7: at least one published (remaining are cancelled/unknown)
  if (hasSuccess) {
    return { status: 'published', markPublishedAt: true }
  }

  // Rule 8: fallback
  return { status: 'failed', markPublishedAt: false }
}
