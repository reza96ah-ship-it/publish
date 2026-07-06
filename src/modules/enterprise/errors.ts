/**
 * Issue #256: Enterprise — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status. Mirrors customers/errors.ts + agency/errors.ts.
 */

export class EnterpriseError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'EnterpriseError'
  }
}

export class SSOConfigNotFoundError extends EnterpriseError {
  constructor(message = 'پیکربندی SSO یافت نشد') {
    super(message, 404, message)
    this.name = 'SSOConfigNotFoundError'
  }
}

export class CustomRoleNotFoundError extends EnterpriseError {
  constructor(message = 'نقش سفارشی یافت نشد') {
    super(message, 404, message)
    this.name = 'CustomRoleNotFoundError'
  }
}

export class DuplicateRoleError extends EnterpriseError {
  constructor(message = 'نقش با این نام قبلاً ثبت شده است') {
    super(message, 409, message)
    this.name = 'DuplicateRoleError'
  }
}

export class ValidationError extends EnterpriseError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
