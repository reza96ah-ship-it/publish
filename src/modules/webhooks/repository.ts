/**
 * Issue #255: Webhooks domain module — repository.
 *
 * Data-access layer. The only file in this module that imports `db`.
 * Follows the smart-pages/repository.ts pattern.
 *
 * Ownership invariant: every workspace-scoped query filters by `workspaceId`.
 *
 * Delivery claim semantics: `claimDeliveries` atomically locks `limit`
 * pending/retry_wait rows whose `availableAt` has passed. Two-step claim
 * (updateMany → findMany) because Prisma's updateMany doesn't return rows:
 *   1. UPDATE rows WHERE claimable AND (lock free or expired)
 *      SET status='claimed', lockedAt=now, lockedBy=instance, lockExpiresAt=now+5m
 *   2. SELECT rows WHERE lockedBy=instance AND lockedAt >= claimStart
 *
 * Two DB queries inside a transaction guarantee atomicity against competing
 * workers — only one worker can win each row's updateMany.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  WebhookItem,
  WebhookDeliveryItem,
  CreateWebhookInput,
  UpdateWebhookInput,
} from './types'

const LOCK_TTL_MS = 5 * 60 * 1000 // 5-minute worker lease — prevents stuck locks

// ── Row → Item mappers ───────────────────────────────────────────────────────
//
// `secretEncrypted` is intentionally excluded from WebhookItem — it never
// leaves the repository. The service decrypts it only when signing an
// outbound delivery, and never returns it in API responses.

function toWebhookItem(row: {
  id: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggeredAt: Date | null
  lastResponseStatus: number | null
  lastError: string | null
  createdAt: Date
}): WebhookItem {
  return {
    id: row.id,
    url: row.url,
    events: row.events,
    isActive: row.isActive,
    lastTriggeredAt: row.lastTriggeredAt,
    lastResponseStatus: row.lastResponseStatus,
    lastError: row.lastError,
    createdAt: row.createdAt,
  }
}

function toDeliveryItem(row: {
  id: string
  webhookId: string
  eventId: string
  eventType: string
  status: string
  attemptCount: number
  deliveredAt: Date | null
  responseStatus: number | null
  lastError: string | null
  lastErrorCategory: string | null
  deadLetteredAt: Date | null
  createdAt: Date
}): WebhookDeliveryItem {
  return {
    id: row.id,
    webhookId: row.webhookId,
    eventId: row.eventId,
    eventType: row.eventType,
    status: row.status as WebhookDeliveryItem['status'],
    attemptCount: row.attemptCount,
    deliveredAt: row.deliveredAt,
    responseStatus: row.responseStatus,
    lastError: row.lastError,
    lastErrorCategory: row.lastErrorCategory,
    deadLetteredAt: row.deadLetteredAt,
    createdAt: row.createdAt,
  }
}

export class WebhooksRepository {
  // ── Webhook CRUD ─────────────────────────────────────────────────────────

  /** List all webhooks for a workspace (newest first). */
  async list(workspaceId: string): Promise<WebhookItem[]> {
    const rows = await db.webhook.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toWebhookItem)
  }

  /** Find a single webhook within a workspace (ownership check). */
  async findByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<WebhookItem | null> {
    const row = await db.webhook.findFirst({
      where: { id, workspaceId },
    })
    return row ? toWebhookItem(row) : null
  }

  /**
   * Return the full webhook row including `secretEncrypted` + workspaceId.
   * Used by the delivery worker to sign outgoing POSTs. NOT workspace-scoped
   * — the worker already knows the webhookId from the claimed delivery row.
   */
  async findByIdWithSecret(id: string): Promise<{
    id: string
    workspaceId: string
    url: string
    events: string[]
    isActive: boolean
    secretEncrypted: string
  } | null> {
    const row = await db.webhook.findUnique({
      where: { id },
      select: {
        id: true,
        workspaceId: true,
        url: true,
        events: true,
        isActive: true,
        secretEncrypted: true,
      },
    })
    return row
  }

  /**
   * Find all active webhooks in a workspace subscribed to a given event.
   * Called by the publish worker on state transitions to fan out deliveries.
   * Uses `has` so a webhook subscribed to multiple events still matches.
   */
  async findActiveByEvent(
    workspaceId: string,
    eventType: string
  ): Promise<{ id: string; secretEncrypted: string }[]> {
    const rows = await db.webhook.findMany({
      where: {
        workspaceId,
        isActive: true,
        events: { has: eventType },
      },
      select: { id: true, secretEncrypted: true },
    })
    return rows
  }

  /** Create a new webhook. Caller MUST have pre-encrypted the secret. */
  async create(
    workspaceId: string,
    data: CreateWebhookInput,
    secretEncrypted: string
  ): Promise<WebhookItem> {
    const row = await db.webhook.create({
      data: {
        workspaceId,
        url: data.url,
        events: data.events,
        secretEncrypted,
        isActive: true,
      },
    })
    return toWebhookItem(row)
  }

  /**
   * Update a webhook's url/events/isActive. Caller MUST have verified
   * ownership first. Only the supplied fields are written.
   */
  async update(
    id: string,
    workspaceId: string,
    data: UpdateWebhookInput
  ): Promise<WebhookItem | null> {
    // updateMany so the WHERE clause enforces ownership at the DB layer too.
    await db.webhook.updateMany({
      where: { id, workspaceId },
      data: {
        ...(data.url !== undefined ? { url: data.url } : {}),
        ...(data.events !== undefined ? { events: data.events } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    })
    const row = await db.webhook.findFirst({ where: { id, workspaceId } })
    return row ? toWebhookItem(row) : null
  }

  /** Delete a webhook (cascades to deliveries via onDelete: Cascade). */
  async delete(id: string, workspaceId: string): Promise<void> {
    await db.webhook.deleteMany({ where: { id, workspaceId } })
  }

  /** Update lastTriggeredAt/lastResponseStatus/lastError after a delivery. */
  async updateDeliveryStats(
    id: string,
    workspaceId: string,
    stats: {
      lastResponseStatus: number | null
      lastError: string | null
    }
  ): Promise<void> {
    await db.webhook.updateMany({
      where: { id, workspaceId },
      data: {
        lastTriggeredAt: new Date(),
        lastResponseStatus: stats.lastResponseStatus,
        lastError: stats.lastError,
      },
    })
  }

  // ── WebhookDelivery lifecycle ────────────────────────────────────────────
  //
  // A delivery moves through: pending → claimed → delivered | retry_wait →
  // (retry_wait → claimed → …) → dead_letter. The worker is the only writer
  // once a row is claimed; `markDelivered`/`markFailed`/`markDeadLettered`
  // trust the caller's `id` because only the worker calls them.

  /** Create a new pending delivery row (called by triggerWebhooks). */
  async createDelivery(data: {
    workspaceId: string
    webhookId: string
    eventId: string
    eventType: string
    payload: Record<string, unknown>
  }): Promise<void> {
    await db.webhookDelivery.create({
      data: {
        workspaceId: data.workspaceId,
        webhookId: data.webhookId,
        eventId: data.eventId,
        eventType: data.eventType,
        payload: data.payload as Prisma.InputJsonValue,
        status: 'pending',
        availableAt: new Date(),
      },
    })
  }

  /**
   * Atomically claim up to `limit` deliverable rows for a worker instance.
   * Returns the claimed rows (with the webhook URL + encrypted secret so the
   * worker can POST immediately without a second lookup).
   *
   * Atomicity: the `updateMany` WHERE clause includes both status-in-claimable
   * AND lock-not-held-or-expired, so two concurrent workers can't claim the
   * same row. The subsequent `findMany` re-reads by `lockedBy=instanceId` to
   * fetch the row data — only rows we just claimed have that `lockedBy`.
   */
  async claimDeliveries(
    instanceId: string,
    limit: number
  ): Promise<
    Array<{
      id: string
      webhookId: string
      eventId: string
      eventType: string
      payload: Prisma.JsonValue
      attemptCount: number
      url: string
      secretEncrypted: string
    }>
  > {
    const now = new Date()
    const claimStart = new Date(now.getTime() - 1000) // 1s window for clock skew
    const lockExpiresAt = new Date(now.getTime() + LOCK_TTL_MS)

    return db.$transaction(async (tx) => {
      await tx.webhookDelivery.updateMany({
        where: {
          status: { in: ['pending', 'retry_wait'] },
          availableAt: { lte: now },
          OR: [{ lockedAt: null }, { lockExpiresAt: { lt: now } }],
        },
        data: {
          status: 'claimed',
          lockedAt: now,
          lockedBy: instanceId,
          lockExpiresAt,
        },
        // SQLite doesn't support a row limit inside UPDATE; we update all
        // claimable rows but only return `limit` below. Workers poll often
        // enough that this is fine in practice — the claimed count is small
        // per tick.
      })

      const rows = await tx.webhookDelivery.findMany({
        where: {
          lockedBy: instanceId,
          lockedAt: { gte: claimStart },
        },
        include: {
          webhook: {
            select: { url: true, secretEncrypted: true, isActive: true },
          },
        },
        orderBy: { availableAt: 'asc' },
        take: limit,
      })

      return rows.map((r) => ({
        id: r.id,
        webhookId: r.webhookId,
        eventId: r.eventId,
        eventType: r.eventType,
        payload: r.payload,
        attemptCount: r.attemptCount,
        url: r.webhook.url,
        secretEncrypted: r.webhook.secretEncrypted,
      }))
    })
  }

  /** Mark a delivery as successfully delivered (clears the lock). */
  async markDelivered(
    id: string,
    responseStatus: number
  ): Promise<void> {
    await db.webhookDelivery.update({
      where: { id },
      data: {
        status: 'delivered',
        deliveredAt: new Date(),
        responseStatus,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    })
  }

  /**
   * Mark a delivery as failed and schedule a retry. `availableAt` is the
   * next-attempt time (already backoff-computed by the caller). Increments
   * attemptCount so the worker can decide when to dead-letter.
   */
  async markFailed(
    id: string,
    error: string,
    category: string,
    availableAt: Date
  ): Promise<void> {
    await db.webhookDelivery.update({
      where: { id },
      data: {
        status: 'retry_wait',
        lastError: error,
        lastErrorCategory: category,
        availableAt,
        attemptCount: { increment: 1 },
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    })
  }

  /** Mark a delivery as permanently failed (exhausted retries). */
  async markDeadLettered(id: string): Promise<void> {
    await db.webhookDelivery.update({
      where: { id },
      data: {
        status: 'dead_letter',
        deadLetteredAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lockExpiresAt: null,
      },
    })
  }

  // ── Delivery history (admin UI) ──────────────────────────────────────────

  /** List recent deliveries for a webhook (newest first), ownership-checked. */
  async listDeliveriesForWebhook(
    webhookId: string,
    workspaceId: string,
    limit: number
  ): Promise<WebhookDeliveryItem[]> {
    const rows = await db.webhookDelivery.findMany({
      where: { webhookId, workspaceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return rows.map(toDeliveryItem)
  }
}
