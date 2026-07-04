/**
 * Issue #124: Publications domain module — types.
 *
 * Shared types for the publications domain. These are the data contracts
 * between the route handler, service, and repository layers.
 *
 * No imports from Prisma or Next.js here — pure domain types.
 */

export type PublishMode = 'publish' | 'review' | 'draft'
export type ScheduleMode = 'now' | 'schedule' | 'queue'

export interface PublishRequest {
  title: string
  caption?: string
  hashtags?: string
  note?: string
  campaignId?: string
  mediaIds?: string[]
  channelIds?: string[]
  platformCaptions?: Record<string, string>
  scheduleMode: ScheduleMode
  scheduledAt?: string | null
  mode?: PublishMode
}

export interface PublishResult {
  contentId: string
  jobs: { id: string; platform: string; idempotencyKey: string }[]
  scheduledAt: string | null
  message: string
}

export interface AuthContext {
  workspaceId: string
  userId: string
  authorName: string
  role: string
  /**
   * Issue #155: W3C trace context for the incoming request. Propagated through
   * the service → repository → OutboxEvent.traceParent so the worker can continue
   * the same trace when processing the queued job.
   */
  trace?: import('@/lib/tracing').TraceContext
}

// Issue #200: manual resolution for unknown publication outcomes (Issue #149)
export type ResolveAction =
  | 'mark_published'
  | 'confirm_failure'
  | 'abandon'
  | 'duplicate_safe_retry'

export interface ResolveRequest {
  action: ResolveAction
  providerPostId?: string
  reason: string
}

export interface ResolveResult {
  ok: true
  message: string
  action: ResolveAction
}
