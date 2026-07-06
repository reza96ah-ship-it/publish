/**
 * Issue #249: Versioned workflow builder — errors.
 *
 * Domain-specific error classes so route handlers can map them to HTTP
 * statuses without knowing internal business logic.
 *
 * Pattern (matches smart-pages/errors.ts):
 *   - Base `AutomationError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof AutomationError` and maps to status.
 */

export class AutomationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'AutomationError'
  }
}

export class AutomationNotFoundError extends AutomationError {
  constructor(message = 'اتوماسیون یافت نشد') {
    super(message, 404, message)
    this.name = 'AutomationNotFoundError'
  }
}

export class ValidationError extends AutomationError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
