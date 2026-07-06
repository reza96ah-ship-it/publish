/**
 * Issue #221: IRR billing — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status. Mirrors the other module error patterns.
 */

export class BillingError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'BillingError'
  }
}

export class ValidationError extends BillingError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class PlanNotFoundError extends BillingError {
  constructor(message = 'طرح یافت نشد') {
    super(message, 404, message)
    this.name = 'PlanNotFoundError'
  }
}

export class InvoiceNotFoundError extends BillingError {
  constructor(message = 'فاکتور یافت نشد') {
    super(message, 404, message)
    this.name = 'InvoiceNotFoundError'
  }
}

export class PaymentGatewayError extends BillingError {
  constructor(message = 'خطا در ارتباط با درگاه پرداخت') {
    super(message, 502, message)
    this.name = 'PaymentGatewayError'
  }
}

export class PaymentVerificationError extends BillingError {
  constructor(message = 'پرداخت تأیید نشد') {
    super(message, 400, message)
    this.name = 'PaymentVerificationError'
  }
}

export class QuotaExceededError extends BillingError {
  constructor(message: string) {
    super(message, 402, message)
    this.name = 'QuotaExceededError'
  }
}
