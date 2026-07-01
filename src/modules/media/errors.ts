/**
 * Issue #156: Media domain module — errors.
 *
 * Domain errors so the route handler can map them to HTTP status without
 * knowing internal business logic. Each error carries a Persian user message
 * and an HTTP status code.
 */

export class MediaError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'MediaError'
  }
}

export class ValidationError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class FileTooLargeError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'FileTooLargeError'
  }
}

export class QuotaExceededError extends MediaError {
  constructor(message: string) {
    super(message, 413, message)
    this.name = 'QuotaExceededError'
  }
}

export class TooManyPendingUploadsError extends MediaError {
  constructor(message: string) {
    super(message, 429, message)
    this.name = 'TooManyPendingUploadsError'
  }
}

export class MediaNotFoundError extends MediaError {
  constructor(message = 'رسانه یافت نشد') {
    super(message, 404, message)
    this.name = 'MediaNotFoundError'
  }
}

export class MediaAlreadyRejectedError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'MediaAlreadyRejectedError'
  }
}

export class MediaNotUploadedyetError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'MediaNotUploadedyetError'
  }
}

export class UploadExpiredError extends MediaError {
  constructor(message: string) {
    super(message, 410, message)
    this.name = 'UploadExpiredError'
  }
}

export class MediaReferencedByActivePublicationError extends MediaError {
  constructor(message: string) {
    super(message, 409, message)
    this.name = 'MediaReferencedByActivePublicationError'
  }
}

export class UnsupportedFormatError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'UnsupportedFormatError'
  }
}

export class ChecksumMismatchError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ChecksumMismatchError'
  }
}

export class SizeMismatchError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'SizeMismatchError'
  }
}

export class TypeMismatchError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'TypeMismatchError'
  }
}

export class ImageTooLargeError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ImageTooLargeError'
  }
}

export class ImageDecodeFailedError extends MediaError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ImageDecodeFailedError'
  }
}
