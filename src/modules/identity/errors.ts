/**
 * Identity domain module — errors.
 *
 * Domain errors so the route handler can map them to HTTP status without
 * knowing internal business logic.
 */

export class IdentityError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'IdentityError'
  }
}

export class ValidationError extends IdentityError {
  constructor(message = 'کد تأیید الزامی است') {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class MfaNotPendingError extends IdentityError {
  constructor(message = 'ابتدا مرحله راه‌اندازی MFA را انجام دهید') {
    super(message, 400, message)
    this.name = 'MfaNotPendingError'
  }
}

export class MfaInvalidCodeError extends IdentityError {
  constructor(message = 'کد تأیید نامعتبر است') {
    super(message, 400, message)
    this.name = 'MfaInvalidCodeError'
  }
}

export class MfaNotEnabledError extends IdentityError {
  constructor(message = 'MFA فعال نیست') {
    super(message, 400, message)
    this.name = 'MfaNotEnabledError'
  }
}

export class MfaInvalidDisableCodeError extends IdentityError {
  constructor(message = 'کد تأیید یا کد پشتیبان نامعتبر است') {
    super(message, 400, message)
    this.name = 'MfaInvalidDisableCodeError'
  }
}
