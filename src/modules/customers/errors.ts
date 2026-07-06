/**
 * Issue #248: Customer profiles + case management — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status without knowing the internal business logic.
 *
 * Pattern (matches smart-pages/errors.ts + agency/errors.ts):
 *   - Base `CustomerError` carries an HTTP statusCode + Persian userMessage.
 *   - Route handler catches with `instanceof CustomerError` and maps to status.
 */

export class CustomerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'CustomerError'
  }
}

export class CustomerNotFoundError extends CustomerError {
  constructor(message = 'مشتری یافت نشد') {
    super(message, 404, message)
    this.name = 'CustomerNotFoundError'
  }
}

export class CaseNotFoundError extends CustomerError {
  constructor(message = 'پرونده یافت نشد') {
    super(message, 404, message)
    this.name = 'CaseNotFoundError'
  }
}

export class ParticipantNotFoundError extends CustomerError {
  constructor(message = 'شرکت‌کننده یافت نشد') {
    super(message, 404, message)
    this.name = 'ParticipantNotFoundError'
  }
}

export class DuplicateParticipantError extends CustomerError {
  constructor(message = 'این مشتری قبلاً به پرونده اضافه شده است') {
    super(message, 409, message)
    this.name = 'DuplicateParticipantError'
  }
}

export class MergeConflictError extends CustomerError {
  constructor(message = 'مشتری هدف برای ادغام نامعتبر است') {
    super(message, 400, message)
    this.name = 'MergeConflictError'
  }
}

export class ValidationError extends CustomerError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
