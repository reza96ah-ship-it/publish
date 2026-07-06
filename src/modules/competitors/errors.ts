/**
 * Issue #253: Competitor tracking — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status. Mirrors customers/errors.ts + agency/errors.ts.
 */

export class CompetitorError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'CompetitorError'
  }
}

export class CompetitorNotFoundError extends CompetitorError {
  constructor(message = 'رقیب یافت نشد') {
    super(message, 404, message)
    this.name = 'CompetitorNotFoundError'
  }
}

export class ValidationError extends CompetitorError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}
