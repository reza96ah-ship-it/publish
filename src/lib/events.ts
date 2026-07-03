/**
 * Nashrino Product Event Taxonomy — v1
 *
 * Privacy rules:
 * - NEVER log captions, DMs, post text, tokens, or personal data in event properties.
 * - Platform names (instagram, twitter, etc.) are OK — they are non-personal metadata.
 * - User IDs are workspace-scoped (never global user PII).
 * - Retention: 90 days for behavioural events, 2 years for billing events.
 * - All events are workspace-scoped; no cross-workspace data sharing.
 *
 * Owner: product@nashrino.com
 * Schema version: 1
 */

// ─── Shared base ────────────────────────────────────────────────────────────

export interface BaseEvent {
  /** ISO-8601 timestamp; set by track() if omitted */
  timestamp?: string
  /** Workspace (tenant) scope — always required */
  workspaceId: string
  /** Session-scoped user within the workspace */
  userId?: string
}

// ─── Onboarding ─────────────────────────────────────────────────────────────

export interface OnboardingStartedEvent extends BaseEvent {
  event: 'onboarding_started'
  source: 'signup' | 'invite'
}

export interface OnboardingStepCompletedEvent extends BaseEvent {
  event: 'onboarding_step_completed'
  step: number
}

export interface OnboardingCompletedEvent extends BaseEvent {
  event: 'onboarding_completed'
  durationMs: number
}

// ─── Channel connect ─────────────────────────────────────────────────────────

export interface ChannelConnectStartedEvent extends BaseEvent {
  event: 'channel_connect_started'
  platformType: string
}

export interface ChannelConnectSucceededEvent extends BaseEvent {
  event: 'channel_connect_succeeded'
  platformType: string
  accountKind: 'personal' | 'business' | 'creator'
}

export interface ChannelConnectFailedEvent extends BaseEvent {
  event: 'channel_connect_failed'
  platformType: string
  reason: 'oauth_denied' | 'token_exchange_failed' | 'validation_failed' | 'unknown'
}

// ─── Content & compose ───────────────────────────────────────────────────────

export interface DraftCreatedEvent extends BaseEvent {
  event: 'draft_created'
  platformCount: number
  hasMedia: boolean
  hasCaption: boolean
}

export interface PreviewOpenedEvent extends BaseEvent {
  event: 'preview_opened'
  platformType: string
}

export interface ValidationFailedEvent extends BaseEvent {
  event: 'validation_failed'
  platformType: string
  /** Validation rule that failed — never the caption text itself */
  rule: string
}

// ─── Approval workflow ───────────────────────────────────────────────────────

export interface ApprovalSubmittedEvent extends BaseEvent {
  event: 'approval_submitted'
  contentId: string
}

export interface ApprovalDecisionEvent extends BaseEvent {
  event: 'approval_decision'
  contentId: string
  decision: 'approved' | 'rejected'
  reviewerRole: string
}

// ─── Publication ─────────────────────────────────────────────────────────────

export interface PublicationQueuedEvent extends BaseEvent {
  event: 'publication_queued'
  jobId: string
  platformType: string
  scheduleType: 'now' | 'schedule' | 'queue'
}

export interface PublicationConfirmedEvent extends BaseEvent {
  event: 'publication_confirmed'
  jobId: string
  platformType: string
  /** Provider-confirmed post ID — not the post content */
  externalId?: string
}

export interface PublicationFailedEvent extends BaseEvent {
  event: 'publication_failed'
  jobId: string
  platformType: string
  errorCode?: string
}

export interface PublicationRecoveredEvent extends BaseEvent {
  event: 'publication_recovered'
  jobId: string
  platformType: string
  recoveryType: 'retry' | 'replay'
}

// ─── Inbox / engagement ──────────────────────────────────────────────────────

export interface InboxAssignedEvent extends BaseEvent {
  event: 'inbox_assigned'
  messageId: string
}

export interface InboxRepliedEvent extends BaseEvent {
  event: 'inbox_replied'
  messageId: string
  /** Never include the reply text */
}

export interface InboxResolvedEvent extends BaseEvent {
  event: 'inbox_resolved'
  messageId: string
  resolutionMs: number
}

export interface SlaBreachedEvent extends BaseEvent {
  event: 'sla_breached'
  messageId: string
  waitMs: number
}

// ─── Reporting ───────────────────────────────────────────────────────────────

export interface ReportCreatedEvent extends BaseEvent {
  event: 'report_created'
  reportType: 'overview' | 'campaign' | 'channel'
  period: '7d' | '30d' | 'custom'
}

export interface ReportExportedEvent extends BaseEvent {
  event: 'report_exported'
  format: 'pdf' | 'csv' | 'xlsx'
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export interface AiSuggestionGeneratedEvent extends BaseEvent {
  event: 'ai_suggestion_generated'
  feature: 'caption' | 'hashtags' | 'draft' | 'assistant'
  platformType?: string
  latencyMs?: number
}

export interface AiSuggestionOutcomeEvent extends BaseEvent {
  event: 'ai_suggestion_outcome'
  feature: 'caption' | 'hashtags' | 'draft' | 'assistant'
  outcome: 'accepted' | 'edited' | 'rejected'
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export interface BillingCheckoutStartedEvent extends BaseEvent {
  event: 'billing_checkout_started'
  plan: string
  billingCycle: 'monthly' | 'annual'
}

export interface BillingCheckoutCompletedEvent extends BaseEvent {
  event: 'billing_checkout_completed'
  plan: string
  billingCycle: 'monthly' | 'annual'
}

export interface BillingCheckoutFailedEvent extends BaseEvent {
  event: 'billing_checkout_failed'
  plan: string
  reason?: string
}

// ─── Union type ──────────────────────────────────────────────────────────────

export type NashrinoEvent =
  | OnboardingStartedEvent
  | OnboardingStepCompletedEvent
  | OnboardingCompletedEvent
  | ChannelConnectStartedEvent
  | ChannelConnectSucceededEvent
  | ChannelConnectFailedEvent
  | DraftCreatedEvent
  | PreviewOpenedEvent
  | ValidationFailedEvent
  | ApprovalSubmittedEvent
  | ApprovalDecisionEvent
  | PublicationQueuedEvent
  | PublicationConfirmedEvent
  | PublicationFailedEvent
  | PublicationRecoveredEvent
  | InboxAssignedEvent
  | InboxRepliedEvent
  | InboxResolvedEvent
  | SlaBreachedEvent
  | ReportCreatedEvent
  | ReportExportedEvent
  | AiSuggestionGeneratedEvent
  | AiSuggestionOutcomeEvent
  | BillingCheckoutStartedEvent
  | BillingCheckoutCompletedEvent
  | BillingCheckoutFailedEvent
