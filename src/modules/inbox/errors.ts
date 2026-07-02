export class InboxMessageNotFoundError extends Error {
  constructor() { super('پیام یافت نشد') }
}

export class AssigneeMemberNotFoundError extends Error {
  constructor() { super('عضو تیم یافت نشد') }
}
