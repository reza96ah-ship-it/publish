/**
 * Issue #251: Social listening foundation + spike alerts — errors.
 *
 * Domain-specific error classes so route handlers can map them to the
 * correct HTTP status without knowing internal business logic.
 *
 * Pattern (matches smart-pages/errors.ts + automations/errors.ts):
 *   - Base `ListeningError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof ListeningError` and maps to status.
 */

export class ListeningError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'ListeningError'
  }
}

export class ListeningQueryNotFoundError extends ListeningError {
  constructor(message = 'جستجوی گوش‌دادن یافت نشد') {
    super(message, 404, message)
    this.name = 'ListeningQueryNotFoundError'
  }
}

export class ListeningValidationError extends ListeningError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ListeningValidationError'
  }
}
