/**
 * Issue #156: Membership domain module — errors.
 *
 * Domain errors so the route handler can map them to HTTP status without
 * knowing internal business logic.
 */

export class MembershipError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly userMessage?: string
  ) {
    super(message)
    this.name = 'MembershipError'
  }
}

export class ValidationError extends MembershipError {
  constructor(message: string) {
    super(message, 400, message)
    this.name = 'ValidationError'
  }
}

export class AlreadyMemberError extends MembershipError {
  constructor(message = 'این کاربر قبلاً عضو این فضای کاری است') {
    super(message, 409, message)
    this.name = 'AlreadyMemberError'
  }
}

export class InvitationAlreadyAcceptedError extends MembershipError {
  constructor(
    message = 'این کاربر قبلاً دعوت‌نامه را پذیرفته است. برای تغییر نقش از مدیریت اعضا استفاده کنید.'
  ) {
    super(message, 409, message)
    this.name = 'InvitationAlreadyAcceptedError'
  }
}

export class InvitationConflictError extends MembershipError {
  constructor(message = 'یک دعوت‌نامه فعال برای این ایمیل وجود دارد') {
    super(message, 409, message)
    this.name = 'InvitationConflictError'
  }
}

export class InvitationNotFoundError extends MembershipError {
  constructor(message = 'دعوت‌نامه یافت نشد') {
    super(message, 404, message)
    this.name = 'InvitationNotFoundError'
  }
}

export class InvitationInvalidError extends MembershipError {
  constructor(message = 'دعوت‌نامه نامعتبر است یا منقضی شده است') {
    super(message, 404, message)
    this.name = 'InvitationInvalidError'
  }
}

export class InvitationExpiredError extends MembershipError {
  constructor(message = 'این دعوت‌نامه منقضی شده است') {
    super(message, 410, message)
    this.name = 'InvitationExpiredError'
  }
}

export class InvitationRevokedError extends MembershipError {
  constructor(message = 'این دعوت‌نامه لغو شده است') {
    super(message, 410, message)
    this.name = 'InvitationRevokedError'
  }
}

export class InvitationAcceptMismatchError extends MembershipError {
  constructor(message = 'این دعوت‌نامه برای ایمیل دیگری صادر شده است') {
    super(message, 403, message)
    this.name = 'InvitationAcceptMismatchError'
  }
}

export class CannotRevokeAcceptedInvitationError extends MembershipError {
  constructor(message = 'نمی‌توان دعوت‌نامه پذیرفته‌شده را لغو کرد') {
    super(message, 400, message)
    this.name = 'CannotRevokeAcceptedInvitationError'
  }
}

export class MemberNotFoundError extends MembershipError {
  constructor(message = 'عضو یافت نشد') {
    super(message, 404, message)
    this.name = 'MemberNotFoundError'
  }
}

export class LastAdminError extends MembershipError {
  constructor(message = 'نمی‌توان تنها مدیر فضای کاری را تنزل داد') {
    super(message, 409, message)
    this.name = 'LastAdminError'
  }
}

export class CannotRemoveLastAdminError extends MembershipError {
  constructor(message = 'نمی‌توان تنها مدیر فضای کاری را حذف کرد') {
    super(message, 409, message)
    this.name = 'CannotRemoveLastAdminError'
  }
}

export class CannotRemoveSelfError extends MembershipError {
  constructor(message = 'نمی‌توانید خودتان را از فضای کاری حذف کنید') {
    super(message, 400, message)
    this.name = 'CannotRemoveSelfError'
  }
}
