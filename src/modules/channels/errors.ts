export class PlatformNotFoundError extends Error {
  constructor() { super('پلتفرم یافت نشد') }
}

export class UnsupportedProviderError extends Error {
  constructor(type: string) { super(`آداپتور پلتفرم «${type}» پشتیبانی نمی‌شود`) }
}

export class CredentialValidationError extends Error {
  constructor(message: string) { super(message || 'اعتبارسنجی ناموفق بود') }
}
