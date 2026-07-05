/**
 * Issue #255: API Tokens domain module — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status without knowing the internal business logic.
 *
 * Pattern (matches smart-pages/errors.ts + publications/errors.ts):
 *   - Base `ApiTokenError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof ApiTokenError` and maps to status.
 */

export class ApiTokenError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'ApiTokenError'
  }
}

export class ApiTokenNotFoundError extends ApiTokenError {
  constructor(message = 'توکن یافت نشد') {
    super(message, 404, message)
    this.name = 'ApiTokenNotFoundError'
  }
}

export class ValidationError extends ApiTokenError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
