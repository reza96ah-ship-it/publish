/**
 * Issue #254: Agency multi-client overview domain module — errors.
 *
 * Domain-specific error classes so route handlers can map them to HTTP status
 * codes without knowing internal business logic. Mirrors the smart-pages +
 * listening pattern: base `AgencyError` carries an HTTP statusCode + a Persian
 * `userMessage`. The route handler catches with `instanceof AgencyError` and
 * maps to status.
 */

export class AgencyError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'AgencyError'
  }
}

export class AgencyNotFoundError extends AgencyError {
  constructor(message = 'پروفایل آژانس یافت نشد') {
    super(message, 404, message)
    this.name = 'AgencyNotFoundError'
  }
}

export class TemplateNotFoundError extends AgencyError {
  constructor(message = 'قالب یافت نشد') {
    super(message, 404, message)
    this.name = 'TemplateNotFoundError'
  }
}

export class PortalAccessNotFoundError extends AgencyError {
  constructor(message = 'دسترسی پورتال یافت نشد') {
    super(message, 404, message)
    this.name = 'PortalAccessNotFoundError'
  }
}

export class ValidationError extends AgencyError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
