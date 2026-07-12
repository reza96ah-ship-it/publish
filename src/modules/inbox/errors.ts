export class InboxMessageNotFoundError extends Error {
  constructor() { super('پیام یافت نشد') }
}

export class AssigneeMemberNotFoundError extends Error {
  constructor() { super('عضو تیم یافت نشد') }
}

export class InboxThreadClaimConflictError extends Error {
  constructor() {
    super('این گفتگو در حال حاضر توسط عضو دیگری در حال پاسخ‌گویی است')
    this.name = 'InboxThreadClaimConflictError'
  }
}
