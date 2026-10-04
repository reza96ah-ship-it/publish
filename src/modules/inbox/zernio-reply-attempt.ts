import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'

const STALE_PENDING_MS = 30_000
const NOT_SENT_REVIEW_WAIT_MS = 5 * 60_000

export class ReplyAttemptError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message)
    this.name = 'ReplyAttemptError'
  }
}

export type ReplyAttemptStart =
  | { kind: 'send'; id: string }
  | { kind: 'sent'; threadMessageId: string }

function replyHash(reply: string): string {
  return createHash('sha256').update(reply.trim()).digest('hex')
}

type ExistingAttempt = NonNullable<Awaited<ReturnType<typeof db.inboxReplyAttempt.findUnique>>>

async function resumeAttempt(
  attempt: ExistingAttempt,
  workspaceId: string,
  threadId: string,
  hash: string,
): Promise<ReplyAttemptStart> {
  if (attempt.workspaceId !== workspaceId || attempt.threadId !== threadId || attempt.replyHash !== hash) {
    throw new ReplyAttemptError('reply_key_conflict', 'این شناسهٔ ارسال برای پاسخ دیگری استفاده شده است')
  }
  if (attempt.status === 'sent' && attempt.threadMessageId) {
    return { kind: 'sent', threadMessageId: attempt.threadMessageId }
  }
  if (attempt.status === 'rejected') {
    throw new ReplyAttemptError('reply_rejected', 'این ارسال رد شد؛ متن را بررسی کنید و دوباره ارسال کنید')
  }
  if (attempt.status.startsWith('resolved_')) {
    throw new ReplyAttemptError('reply_resolved', 'وضعیت این ارسال قبلاً بررسی و ثبت شده است')
  }
  const now = Date.now()
  if (attempt.status === 'unknown') {
    throw new ReplyAttemptError('reply_outcome_unknown', 'نتیجهٔ ارسال نامشخص است؛ پیش از ارسال پیام دیگر، گفتگو را در اینستاگرام بررسی کنید')
  }
  if (attempt.status === 'pending' && now - attempt.updatedAt.getTime() < STALE_PENDING_MS) {
    throw new ReplyAttemptError('reply_in_progress', 'ارسال هنوز در حال بررسی است؛ چند لحظه صبر کنید')
  }
  if (attempt.status === 'pending') {
    await db.inboxReplyAttempt.updateMany({
      where: { id: attempt.id, status: 'pending', updatedAt: { lt: new Date(now - STALE_PENDING_MS) } },
      data: { status: 'unknown' },
    })
  }
  throw new ReplyAttemptError('reply_outcome_unknown', 'نتیجهٔ ارسال نامشخص است؛ پیش از ارسال پیام دیگر، گفتگو را در اینستاگرام بررسی کنید')
}

export async function beginZernioReplyAttempt(
  workspaceId: string,
  threadId: string,
  idempotencyKey: string,
  reply: string,
): Promise<ReplyAttemptStart> {
  const hash = replyHash(reply)
  const existing = await db.inboxReplyAttempt.findUnique({ where: { idempotencyKey } })
  if (existing) return resumeAttempt(existing, workspaceId, threadId, hash)

  const unresolved = await db.inboxReplyAttempt.findFirst({
    where: { workspaceId, threadId, status: { in: ['pending', 'unknown'] } },
  })
  if (unresolved) {
    throw new ReplyAttemptError(
      'reply_previous_unresolved',
      'ارسال قبلی هنوز تأیید نشده است؛ گفتگو را تازه‌سازی کنید و همان ارسال را دوباره بررسی کنید',
    )
  }
  try {
    const attempt = await db.inboxReplyAttempt.create({
      data: { workspaceId, threadId, activeThreadId: threadId, idempotencyKey, replyHash: hash },
    })
    return { kind: 'send', id: attempt.id }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    const matching = await db.inboxReplyAttempt.findUnique({ where: { idempotencyKey } })
    if (matching) return resumeAttempt(matching, workspaceId, threadId, hash)
    throw new ReplyAttemptError('reply_in_progress', 'ارسال دیگری برای این گفتگو در حال انجام است')
  }
}

export async function markZernioReplyAttempt(
  attemptId: string,
  status: 'unknown' | 'rejected',
): Promise<void> {
  await db.inboxReplyAttempt.updateMany({
    where: { id: attemptId, status: 'pending' },
    data: { status, ...(status === 'rejected' ? { activeThreadId: null } : {}) },
  })
}

export async function getOpenZernioReplyAttempt(workspaceId: string, threadId: string) {
  return db.inboxReplyAttempt.findFirst({
    where: { workspaceId, threadId, status: { in: ['pending', 'unknown'] } },
    select: { idempotencyKey: true, status: true, createdAt: true, updatedAt: true },
  })
}

export async function resolveZernioReplyAttempt(input: {
  workspaceId: string
  threadId: string
  idempotencyKey: string
  resolution: 'sent' | 'not_sent'
  userId: string
}): Promise<void> {
  await db.$transaction(async (tx) => {
    const attempt = await tx.inboxReplyAttempt.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
    if (!attempt || attempt.workspaceId !== input.workspaceId || attempt.threadId !== input.threadId
      || !['pending', 'unknown'].includes(attempt.status)) {
      throw new ReplyAttemptError('reply_attempt_not_found', 'ارسال نامشخصی برای این گفتگو پیدا نشد')
    }
    if (attempt.status === 'pending' && Date.now() - attempt.updatedAt.getTime() < STALE_PENDING_MS) {
      throw new ReplyAttemptError('reply_in_progress', 'ارسال هنوز در حال انجام است؛ کمی بعد وضعیت را بررسی کنید')
    }
    if (input.resolution === 'not_sent' && Date.now() - attempt.createdAt.getTime() < NOT_SENT_REVIEW_WAIT_MS) {
      throw new ReplyAttemptError('reply_review_wait', 'برای اطمینان از ارسال نشدن، حداقل پنج دقیقه صبر کنید و دوباره اینستاگرام را بررسی کنید')
    }
    const changed = await tx.inboxReplyAttempt.updateMany({
      where: { id: attempt.id, status: attempt.status },
      data: { status: input.resolution === 'sent' ? 'resolved_sent' : 'resolved_not_sent', activeThreadId: null },
    })
    if (!changed.count) throw new ReplyAttemptError('reply_in_progress', 'وضعیت ارسال هم‌زمان تغییر کرده است؛ صفحه را تازه‌سازی کنید')
    await tx.auditLog.create({
      data: {
        workspaceId: input.workspaceId, userId: input.userId,
        action: 'inbox.zernio_reply_manually_resolved', resource: 'InboxReplyAttempt',
        metadata: { threadId: input.threadId, attemptId: attempt.id, resolution: input.resolution },
      },
    })
  })
}

export async function completeZernioReplyAttempt(input: {
  attemptId: string
  threadId: string
  workspaceId: string
  platformId: string
  messageType: string
  reply: string
  providerMessageId: string | null
}): Promise<string> {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const providerMessageId = input.providerMessageId ?? `zernio-outbound:${input.attemptId}`
    const inserted = await tx.inboxThreadMessage.createMany({
      data: [{
        threadId: input.threadId,
        workspaceId: input.workspaceId,
        platformId: input.platformId,
        providerMessageId,
        direction: 'outbound',
        messageType: input.messageType,
        senderName: 'You',
        body: input.reply.trim(),
        payload: { source: 'app-reply', providerAcknowledged: true, providerMessageId: input.providerMessageId },
        createdAt: now,
      }],
      skipDuplicates: true,
    })
    const message = await tx.inboxThreadMessage.findUnique({
      where: { platformId_providerMessageId: { platformId: input.platformId, providerMessageId } },
      select: { id: true, threadId: true },
    })
    if (!message || message.threadId !== input.threadId) throw new Error('zernio_reply_receipt_conflict')
    if (inserted.count) {
      await tx.inboxThread.update({
        where: { id: input.threadId },
        data: { unreadCount: 0, status: 'in_progress', lastMessageAt: now },
      })
      await tx.inboxThread.updateMany({
        where: { id: input.threadId, firstResponseAt: null },
        data: { firstResponseAt: now },
      })
    }
    await tx.inboxReplyAttempt.update({
      where: { id: input.attemptId },
      data: { status: 'sent', activeThreadId: null, providerMessageId: input.providerMessageId, threadMessageId: message.id },
    })
    return message.id
  })
}
