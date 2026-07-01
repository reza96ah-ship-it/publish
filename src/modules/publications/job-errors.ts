/**
 * Issue #156: Publications module — publish-job lifecycle errors.
 *
 * Domain errors for retry/cancel/reschedule/discard so the route handler can
 * map them to HTTP status without knowing internal business logic.
 */

import { PublicationError } from './errors'

export class JobNotFoundError extends PublicationError {
  constructor(message = 'کار یافت نشد') {
    super(message, 404, message)
    this.name = 'JobNotFoundError'
  }
}

export class JobNotCancellableError extends PublicationError {
  constructor(message: string) {
    super(message, 409, message)
    this.name = 'JobNotCancellableError'
  }
}

export class JobConcurrentChangeError extends PublicationError {
  constructor(message = 'وضعیت کار هم‌زمان تغییر کرد — لغو ممکن نشد. صفحه را به‌روزرسانی کنید') {
    super(message, 409, message)
    this.name = 'JobConcurrentChangeError'
  }
}

export class InvalidActionError extends PublicationError {
  constructor(message = 'action نامعتبر است (retry، cancel، discard یا reschedule)') {
    super(message, 400, message)
    this.name = 'InvalidActionError'
  }
}

export class ValidationError extends PublicationError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
