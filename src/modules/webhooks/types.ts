/**
 * Issue #255: Public API + signed webhooks — Webhooks domain types.
 *
 * A Webhook is an HTTPS endpoint registered by a workspace admin to receive
 * notifications when certain events happen (publish.success, inbox.new, …).
 * Each webhook has its own HMAC signing secret (encrypted at rest, shown to
 * the admin ONCE on creation) so the receiver can authenticate the delivery.
 *
 * Deliveries are queued as WebhookDelivery rows; a background worker claims
 * them, POSTs to the URL with HMAC signing, and marks the row delivered /
 * retry-wait / dead-lettered based on the response.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── Webhook item ─────────────────────────────────────────────────────────────

export interface WebhookItem {
  id: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggeredAt: Date | null
  lastResponseStatus: number | null
  lastError: string | null
  createdAt: Date
}

// ── Webhook delivery item ────────────────────────────────────────────────────

export type WebhookDeliveryStatus =
  | 'pending'
  | 'claimed'
  | 'delivered'
  | 'retry_wait'
  | 'dead_letter'
  | 'cancelled'

export interface WebhookDeliveryItem {
  id: string
  webhookId: string
  eventId: string
  eventType: string
  status: WebhookDeliveryStatus
  attemptCount: number
  deliveredAt: Date | null
  responseStatus: number | null
  lastError: string | null
  lastErrorCategory: string | null
  deadLetteredAt: Date | null
  createdAt: Date
}

// ── Create / update inputs ───────────────────────────────────────────────────

export interface CreateWebhookInput {
  url: string
  events: string[]
}

export type UpdateWebhookInput = Partial<CreateWebhookInput> & {
  isActive?: boolean
}

// ── Result shapes ────────────────────────────────────────────────────────────

/**
 * Result of createWebhook — the secret is shown to the admin ONCE and is
 * unrecoverable afterwards. The `webhook` field is the persisted row (no
 * secret); `secret` is the plaintext HMAC key the admin must copy and
 * configure on their receiver.
 */
export interface CreateWebhookResult {
  webhook: WebhookItem
  secret: string
}

/**
 * Result of testWebhook — a single delivery attempt to the configured URL
 * with a synthetic test payload. Used by the admin UI to verify the
 * endpoint is reachable and the receiver is verifying signatures correctly.
 */
export interface TestResult {
  success: boolean
  responseStatus: number | null
  error: string | null
}

// ── Delivery payload (created by triggerWebhooks) ────────────────────────────

/**
 * Payload passed to triggerWebhooks — the worker will JSON-encode this and
 * sign it with the webhook's secret. `eventType` selects which webhooks
 * receive the delivery; `aggregateId` is the id of the resource that
 * triggered the event (e.g. publicationId), used to build the idempotent
 * `eventId`.
 */
export interface WebhookEventPayload {
  eventType: string
  aggregateId: string
  data: Record<string, unknown>
}
