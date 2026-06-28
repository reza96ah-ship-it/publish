/**
 * Issue #124: Publications domain module — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status without knowing the internal business logic.
 *
 * Pattern: each error carries an HTTP status + Persian user message.
 */

export class PublicationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'PublicationError'
  }
}

export class ValidationError extends PublicationError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class PermissionDeniedError extends PublicationError {
  constructor(message = 'دسترسی کافی برای انتشار ندارید') {
    super(message, 403, message)
    this.name = 'PermissionDeniedError'
  }
}

export class NoChannelsError extends PublicationError {
  constructor(message = 'حداقل یک کانال باید انتخاب شود') {
    super(message, 400, message)
    this.name = 'NoChannelsError'
  }
}

export class ChannelsNotFoundError extends PublicationError {
  constructor(message = 'هیچ کانال متصلی برای شناسه‌های انتخاب‌شده یافت نشد') {
    super(message, 400, message)
    this.name = 'ChannelsNotFoundError'
  }
}

export class InvalidBodyError extends PublicationError {
  constructor(message = 'بدنه درخواست نامعتبر است') {
    super(message, 400, message)
    this.name = 'InvalidBodyError'
  }
}
