/**
 * Issue #212: Content versioning + revision history — errors.
 *
 * Domain errors so the route handler can map them to HTTP status without
 * knowing internal business logic. Each error carries a Persian user message
 * and an HTTP status code.
 */

export class RevisionError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'RevisionError'
  }
}

export class RevisionNotFoundError extends RevisionError {
  constructor(message = 'نسخه یافت نشد') {
    super(message, 404, message)
    this.name = 'RevisionNotFoundError'
  }
}

export class ContentNotFoundError extends RevisionError {
  constructor(message = 'محتوا یافت نشد') {
    super(message, 404, message)
    this.name = 'ContentNotFoundError'
  }
}

export class ValidationError extends RevisionError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
