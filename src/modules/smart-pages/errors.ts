/**
 * Issue #250: Smart Pages domain module — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status without knowing the internal business logic.
 *
 * Pattern (matches publications/errors.ts + membership/errors.ts):
 *   - Base `SmartPageError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof SmartPageError` and maps to status.
 */

export class SmartPageError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'SmartPageError'
  }
}

export class SmartPageNotFoundError extends SmartPageError {
  constructor(message = 'صفحه یافت نشد') {
    super(message, 404, message)
    this.name = 'SmartPageNotFoundError'
  }
}

export class SlugConflictError extends SmartPageError {
  constructor(message = 'این نامک قبلاً استفاده شده است') {
    super(message, 409, message)
    this.name = 'SlugConflictError'
  }
}

export class ValidationError extends SmartPageError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
