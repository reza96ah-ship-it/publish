/**
 * Issue #255: Webhook trigger — fan out WebhookDelivery rows on publish state
 * transitions.
 *
 * Called by the publish worker's job-completion path. Finds every active
 * webhook in the workspace subscribed to the given event type and creates a
 * pending `WebhookDelivery` row for each. The actual HTTP POST happens
 * asynchronously in the webhook dispatcher (./webhook-dispatcher.ts), which
 * polls the WebhookDelivery table, claims rows, and delivers them with
 * retry/backoff/dead-letter semantics — mirroring the outbox pattern.
 *
 * Why fire-and-forget per webhook: one bad webhook (slow, 500ing, DNS-failing)
 * must not delay or block delivery to the others. Each webhook gets its own
 * independent delivery row + retry schedule.
 *
 * The `eventId` embeds a timestamp so the same logical event delivered to two
 * different webhooks (or re-triggered by a retry) gets distinct rows — the
 * receiver can dedupe by `eventId` if it wants exactly-once semantics.
 */

import { db } from './db'

/**
 * Find active webhooks in the workspace that listen for this event type,
 * and create a WebhookDelivery row for each. Called after publish state
 * transitions.
 *
 *   eventType — 'publish.success' | 'publish.failed' | …
 *   payload   — the JSON body that will be POSTed to each webhook URL
 *
 * Idempotency: this function is NOT idempotent — calling it twice for the
 * same event creates two delivery rows. Callers must ensure they only fire
 * once per state transition (the publish worker's `case 'success'` branch
 * and `worker.on('failed')` handler are the canonical call sites).
 */
export async function triggerWebhooks(
  workspaceId: string,
  eventType: string, // 'publish.success' or 'publish.failed'
  payload: Record<string, unknown>
): Promise<void> {
  const webhooks = await db.webhook.findMany({
    where: { workspaceId, isActive: true, events: { has: eventType } },
  })
  if (webhooks.length === 0) return

  const eventId = `${eventType}-${payload.publicationId ?? payload.jobId}-${Date.now()}`
  await db.webhookDelivery.createMany({
    data: webhooks.map((w) => ({
      workspaceId,
      webhookId: w.id,
      eventId,
      eventType,
      payload: payload as any, // Prisma JSON column — caller controls the shape
      status: 'pending',
    })),
  })
}
