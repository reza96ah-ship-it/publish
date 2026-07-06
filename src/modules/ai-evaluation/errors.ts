/**
 * Issue #252: AI evaluation harness — errors.
 *
 * Domain-specific error classes so the route handler can map them to the
 * correct HTTP status. Mirrors smart-pages/errors.ts + customers/errors.ts.
 */

export class AIEvaluationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'AIEvaluationError'
  }
}

export class EvaluationSetNotFoundError extends AIEvaluationError {
  constructor(message = 'مجموعه ارزیابی یافت نشد') {
    super(message, 404, message)
    this.name = 'EvaluationSetNotFoundError'
  }
}

export class EvaluationResultNotFoundError extends AIEvaluationError {
  constructor(message = 'نتیجه ارزیابی یافت نشد') {
    super(message, 404, message)
    this.name = 'EvaluationResultNotFoundError'
  }
}

export class ValidationError extends AIEvaluationError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class CaptionGenerationError extends AIEvaluationError {
  constructor(message = 'تولید کپشن با خطا مواجه شد') {
    super(message, 502, message)
    this.name = 'CaptionGenerationError'
  }
}
