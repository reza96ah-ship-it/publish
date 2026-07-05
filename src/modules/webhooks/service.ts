/**
 * Issue #255: Webhooks domain module — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Throws domain errors (WebhookError subclasses) — route handler maps
 *     them to HTTP via `instanceof WebhookError`.
 *
 * Critical security property: the webhook signing secret returned by
 * `create` is the ONLY time it is exposed to anyone — including the admin
 * who created it. The secret is encrypted at rest with AES-256-GCM
 * (src/lib/crypto.ts, key-rotatable) and the plaintext is forgotten. If
 * the admin loses it, they must delete + recreate the webhook.
 *
 * Delivery lifecycle (driven by a background worker that calls the repo
 * directly — service methods here are for the admin CRUD surface + the
 * trigger fan-out called by the publish worker on state transitions):
 *   triggerWebhooks → createDelivery(pending)
 *   worker.claimDeliveries → claim(pending|retry_wait → claimed)
 *   worker POST + verify → markDelivered | markFailed | markDeadLettered
 */

import { randomBytes } from 'crypto'
import { ensureEncrypted, decrypt } from '@/lib/crypto'
import { signWebhook } from '@/lib/webhook-signing'
import { WebhooksRepository } from './repository'
import { WebhookNotFoundError, ValidationError } from './errors'
import type {
  WebhookItem,
  WebhookDeliveryItem,
  CreateWebhookInput,
  CreateWebhookResult,
  UpdateWebhookInput,
  TestResult,
  WebhookEventPayload,
} from './types'

const SECRET_BYTES = 32 // 256-bit HMAC key
const TEST_DELIVERY_TIMEOUT_MS = 10_000

/**
 * Generate a fresh signing secret (256-bit random, base64url).
 * Returned to the admin ONCE on creation; the encrypted form is what's stored.
 */
function generateSecret(): string {
  return randomBytes(SECRET_BYTES).toString('base64url')
}

export class WebhooksService {
  constructor(
    private readonly repo: WebhooksRepository = new WebhooksRepository()
  ) {}

  // ── Admin CRUD ────────────────────────────────────────────────────────────

  /** List all webhooks for the active workspace. */
  async listWebhooks(workspaceId: string): Promise<WebhookItem[]> {
    return this.repo.list(workspaceId)
  }

  /** Alias kept for route-handler brevity. */
  async list(workspaceId: string): Promise<WebhookItem[]> {
    return this.listWebhooks(workspaceId)
  }

  /**
   * Create a new webhook. Generates a random signing secret, encrypts it
   * with AES-256-GCM (src/lib/crypto.ts), persists the encrypted form, and
   * returns both the webhook row and the plaintext secret (shown ONCE).
   */
  async createWebhook(
    workspaceId: string,
    _createdById: string,
    input: CreateWebhookInput
  ): Promise<CreateWebhookResult> {
    if (!input.url || !/^https:\/\//.test(input.url)) {
      throw new ValidationError('آدرس وب‌هوک باید HTTPS باشد')
    }
    if (!input.events || input.events.length === 0) {
      throw new ValidationError('حداقل یک رویداد الزامی است')
    }

    const secret = generateSecret()
    const secretEncrypted = ensureEncrypted(secret)
    const webhook = await this.repo.create(workspaceId, input, secretEncrypted)
    return { webhook, secret }
  }

  /** Alias kept for route-handler brevity. */
  async create(
    workspaceId: string,
    createdById: string,
    input: CreateWebhookInput
  ): Promise<CreateWebhookResult> {
    return this.createWebhook(workspaceId, createdById, input)
  }

  /** Update a webhook's url / events / isActive. Verifies ownership first. */
  async updateWebhook(
    workspaceId: string,
    id: string,
    input: UpdateWebhookInput
  ): Promise<WebhookItem> {
    const existing = await this.repo.findByIdInWorkspace(id, workspaceId)
    if (!existing) throw new WebhookNotFoundError()
    if (input.url !== undefined && !/^https:\/\//.test(input.url)) {
      throw new ValidationError('آدرس وب‌هوک باید HTTPS باشد')
    }
    if (input.events !== undefined && input.events.length === 0) {
      throw new ValidationError('حداقل یک رویداد الزامی است')
    }
    const updated = await this.repo.update(id, workspaceId, input)
    if (!updated) throw new WebhookNotFoundError()
    return updated
  }

  /** Alias kept for route-handler brevity. */
  async update(
    workspaceId: string,
    id: string,
    input: UpdateWebhookInput
  ): Promise<WebhookItem> {
    return this.updateWebhook(workspaceId, id, input)
  }

  /** Delete a webhook (cascades to deliveries). Verifies ownership first. */
  async deleteWebhook(workspaceId: string, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, workspaceId)
    if (!existing) throw new WebhookNotFoundError()
    await this.repo.delete(id, workspaceId)
  }

  /** Alias kept for route-handler brevity. */
  async delete(workspaceId: string, id: string): Promise<void> {
    return this.deleteWebhook(workspaceId, id)
  }

  /**
   * Send a synthetic test delivery to the webhook URL. The receiver should
   * verify the HMAC signature just like a real delivery. Returns the HTTP
   * status (or null if the request failed before getting a response) so the
   * admin UI can render a success/failure indicator.
   *
   * Uses the webhook's stored secret (decrypted in-memory only for this
   * signing) and a 10s timeout so a misconfigured endpoint can't hang the
   * admin UI. Does NOT persist a WebhookDelivery row — test events are
   * fire-and-forget by design.
   */
  async testWebhook(workspaceId: string, id: string): Promise<TestResult> {
    const existing = await this.repo.findByIdInWorkspace(id, workspaceId)
    if (!existing) throw new WebhookNotFoundError()

    const withSecret = await this.repo.findByIdWithSecret(id)
    if (!withSecret) throw new WebhookNotFoundError()

    const secret = decrypt(withSecret.secretEncrypted)
    const testPayload = JSON.stringify({
      event: 'webhook.test',
      webhook_id: id,
      timestamp: new Date().toISOString(),
      data: { message: 'این یک رویداد آزمایشی از نشرینو است' },
    })
    const { signature, timestamp } = signWebhook(secret, testPayload)

    try {
      const controller = new AbortController()
      const timer = setTimeout(
        () => controller.abort(),
        TEST_DELIVERY_TIMEOUT_MS
      )
      const res = await fetch(withSecret.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Nashrino-Signature': signature,
          'X-Nashrino-Timestamp': timestamp,
          'X-Nashrino-Event': 'webhook.test',
        },
        body: testPayload,
        signal: controller.signal,
      })
      clearTimeout(timer)

      // Update lastTriggeredAt / lastResponseStatus so the admin UI reflects
      // the test result alongside real deliveries.
      await this.repo.updateDeliveryStats(id, workspaceId, {
        lastResponseStatus: res.status,
        lastError: res.ok ? null : `HTTP ${res.status}`,
      })

      return {
        success: res.ok,
        responseStatus: res.status,
        error: res.ok ? null : `HTTP ${res.status}`,
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'خطای ناشناخته در ارسال وب‌هوک'
      await this.repo.updateDeliveryStats(id, workspaceId, {
        lastResponseStatus: null,
        lastError: message,
      })
      return {
        success: false,
        responseStatus: null,
        error: message,
      }
    }
  }

  /** Alias kept for route-handler brevity. */
  async test(workspaceId: string, id: string): Promise<TestResult> {
    return this.testWebhook(workspaceId, id)
  }

  // ── Delivery fan-out (called by the publish worker) ──────────────────────

  /**
   * Fan out a webhook event to all active webhooks in the workspace that are
   * subscribed to the event. Creates one WebhookDelivery row per matching
   * webhook — the background worker claims + delivers them.
   *
   * Idempotency: the `eventId` is derived from `${eventType}:${aggregateId}`
   * so a duplicate trigger (e.g. retry-prone state transition) creates a
   * second delivery row only if the first was already delivered. Callers
   * that need strict idempotency should check for an existing delivery
   * before calling this.
   *
   * Fire-and-forget-friendly: errors creating individual deliveries are
   * swallowed so one bad webhook can't break the publish flow. (Failures
   * here are rare — most are DB-level, which surface in ops dashboards.)
   */
  async triggerWebhooks(
    workspaceId: string,
    eventType: string,
    payload: WebhookEventPayload
  ): Promise<void> {
    const webhooks = await this.repo.findActiveByEvent(workspaceId, eventType)
    if (webhooks.length === 0) return

    const eventId = `${eventType}:${payload.aggregateId}`

    await Promise.all(
      webhooks.map(async (w) => {
        try {
          await this.repo.createDelivery({
            workspaceId,
            webhookId: w.id,
            eventId,
            eventType,
            payload: {
              event: eventType,
              event_id: eventId,
              aggregate_id: payload.aggregateId,
              timestamp: new Date().toISOString(),
              data: payload.data,
            },
          })
        } catch {
          /* one failing delivery row must not block the others */
        }
      })
    )
  }

  /** Recent delivery history for a webhook (admin UI). Verifies ownership. */
  async getDeliveryHistory(
    workspaceId: string,
    webhookId: string,
    limit = 50
  ): Promise<WebhookDeliveryItem[]> {
    const existing = await this.repo.findByIdInWorkspace(webhookId, workspaceId)
    if (!existing) throw new WebhookNotFoundError()
    return this.repo.listDeliveriesForWebhook(
      webhookId,
      workspaceId,
      Math.min(limit, 100)
    )
  }

  /** Alias kept for route-handler brevity. */
  async listDeliveries(
    workspaceId: string,
    webhookId: string
  ): Promise<WebhookDeliveryItem[]> {
    return this.getDeliveryHistory(workspaceId, webhookId)
  }
}

export const webhooksService = new WebhooksService()
