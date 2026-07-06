/**
 * Issue #255: Webhooks domain module — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { webhooksService, WebhookError } from '@/modules/webhooks'
 */

export { WebhooksService, webhooksService } from './service'
export { WebhooksRepository } from './repository'
export type {
  AuthContext,
  WebhookItem,
  WebhookDeliveryItem,
  WebhookDeliveryStatus,
  CreateWebhookInput,
  CreateWebhookResult,
  UpdateWebhookInput,
  TestResult,
  WebhookEventPayload,
} from './types'
export { WebhookError, WebhookNotFoundError, ValidationError } from './errors'
