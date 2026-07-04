export class ContentNotFoundError extends Error {
  constructor() { super('محتوا یافت نشد') }
}

export class InvalidStateTransitionError extends Error {
  constructor(from: string, to: string) {
    super(`انتقال وضعیت از «${from}» به «${to}» مجاز نیست`)
  }
}
