/**
 * Issue #156: Publications module — publish-job lifecycle types.
 *
 * Used by the retry/cancel/reschedule/discard service methods added to
 * PublicationsService. Kept in a separate file from the existing types.ts
 * so the original Issue #124 surface stays stable.
 */

export type JobAction = 'retry' | 'discard' | 'cancel' | 'reschedule'

export interface RetryJobResult {
  ok: true
  jobId: string
  status: string
  message: string
}

export interface DiscardJobResult {
  ok: true
  jobId: string
  status: string
  message: string
}

export interface CancelJobResult {
  ok: true
  jobId: string
  status: string
  message: string
}

export interface RescheduleJobResult {
  ok: true
  jobId: string
  status: string
  scheduledAt: string | null
  message: string
}

export interface PublishJobRow {
  id: string
  workspaceId: string
  contentId: string
  platformId: string
  status: string
  processLabel: string | null
  progress: number
  retryCount: number
  error: string | null
  idempotencyKey: string
  scheduledAt: Date | null
  startedAt: Date | null
  completedAt: Date | null
  externalId: string | null
  thumbnailUrl: string | null
}

export interface PublicationRow {
  id: string
  publishJobId: string | null
  revisionId: string | null
  status: string
  providerAcknowledgedAt: Date | null
  completedAt: Date | null
}
