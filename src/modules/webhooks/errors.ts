/**
 * Issue #255: Webhooks domain module — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status without knowing the internal business logic.
 *
 * Pattern (matches api-tokens/errors.ts + smart-pages/errors.ts):
 *   - Base `WebhookError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof WebhookError` and maps to status.
 */

export class WebhookError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'WebhookError'
  }
}

export class WebhookNotFoundError extends WebhookError {
  constructor(message = 'وب‌هوک یافت نشد') {
    super(message, 404, message)
    this.name = 'WebhookNotFoundError'
  }
}

export class ValidationError extends WebhookError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
