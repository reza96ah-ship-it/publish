/**
 * Issue #214: Exportable analytics reports — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status. Mirrors analytics/errors.ts pattern.
 */

export class ReportError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'ReportError'
  }
}

export class ValidationError extends ReportError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class NoDataError extends ReportError {
  constructor(message = 'داده‌ای برای گزارش‌گیری یافت نشد') {
    super(message, 404, message)
    this.name = 'NoDataError'
  }
}
