import { db } from '@/lib/db'
import { sendZernioPrivateCommentReply } from '@/lib/zernio'

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const FUTURE_SKEW_MS = 5 * 60 * 1000

export class PrivateCommentReplyError extends Error {
  constructor(public readonly code: string, message: string, public readonly statusCode: number) {
    super(message)
  }
}

type Auth = { workspaceId: string; userId: string }
type Send = typeof sendZernioPrivateCommentReply

export type PrivateCommentReplyState = {
  available: boolean
  status: string | null
  expiresAt: string | null
  reason: 'unsupported' | 'missing_comment' | 'window_closed' | 'already_attempted' | 'resolved' | null
}

async function context(workspaceId: string, threadId: string) {
  const thread = await db.inboxThread.findFirst({
    where: { id: threadId, workspaceId },
    include: { platform: { select: {
      id: true, type: true, provider: true, providerAccountId: true, name: true,
    } } },
  })
  if (!thread) throw new PrivateCommentReplyError('not_found', 'گفتگو یافت نشد', 404)
  if (thread.messageType !== 'comment' || thread.platform.type !== 'instagram' ||
      thread.platform.provider !== 'zernio' || !/^[a-f\d]{24}$/i.test(thread.platform.providerAccountId ?? '') ||
      !thread.providerThreadId.startsWith('comment:')) return { thread, root: null, postId: null, commentId: null }
  const root = await db.inboxThreadMessage.findFirst({
    where: { threadId, workspaceId, platformId: thread.platformId,
      providerMessageId: thread.providerThreadId, direction: 'inbound', messageType: 'comment' },
  })
  const payload = root?.payload && typeof root.payload === 'object' && !Array.isArray(root.payload)
    ? root.payload as Record<string, unknown> : null
  const postId = typeof payload?.postId === 'string' && payload.postId.trim() ? payload.postId : null
  return { thread, root, postId, commentId: thread.providerThreadId.slice('comment:'.length) }
}

export async function getPrivateCommentReplyState(
  workspaceId: string, threadId: string, now = new Date(),
): Promise<PrivateCommentReplyState> {
  const { thread, root, postId, commentId } = await context(workspaceId, threadId)
  if (!commentId) return { available: false, status: null, expiresAt: null, reason: 'unsupported' }
  if (!root || !postId || !root.senderExternalId) {
    return { available: false, status: null, expiresAt: null, reason: 'missing_comment' }
  }
  const expiresAt = new Date(root.createdAt.getTime() + WINDOW_MS).toISOString()
  const prior = await db.commentDmLog.findFirst({
    where: { workspaceId, OR: [
      { claimPlatformId: thread.platformId, commentId },
      { claimPlatformId: thread.platformId, postId, senderUserId: root.senderExternalId },
      { claimPlatformId: null, commentId, status: { in: ['pending', 'sent', 'partial', 'unknown', 'failed'] } },
    ] },
    select: { status: true }, orderBy: { sentAt: 'desc' },
  })
  if (prior) return { available: false, status: prior.status, expiresAt, reason: 'already_attempted' }
  if (thread.status === 'resolved') {
    return { available: false, status: null, expiresAt, reason: 'resolved' }
  }
  const age = now.getTime() - root.createdAt.getTime()
  if (age >= WINDOW_MS || age < -FUTURE_SKEW_MS) {
    return { available: false, status: null, expiresAt, reason: 'window_closed' }
  }
  return { available: true, status: null, expiresAt, reason: null }
}

/** A database claim is shared with comment→DM automation. Never retry a
 * pending/unknown outcome automatically; the provider may have accepted it. */
export async function sendPrivateCommentReply(
  auth: Auth, threadId: string, message: string,
  send: Send = sendZernioPrivateCommentReply, now = new Date(),
): Promise<{ status: 'sent'; providerMessageId: string }> {
  const text = message.trim()
  if (!text || text.length > 1000) {
    throw new PrivateCommentReplyError('invalid_message', 'متن پیام خصوصی باید بین ۱ تا ۱۰۰۰ نویسه باشد', 400)
  }
  const { thread, root, postId, commentId } = await context(auth.workspaceId, threadId)
  const state = await getPrivateCommentReplyState(auth.workspaceId, threadId, now)
  if (!state.available || !root || !postId || !commentId || !root.senderExternalId ||
      !thread.platform.providerAccountId) {
    const code = state.reason ?? 'unavailable'
    throw new PrivateCommentReplyError(code,
      code === 'window_closed' ? 'مهلت هفت‌روزهٔ پاسخ خصوصی به این کامنت پایان یافته است'
        : code === 'already_attempted' ? 'برای این کامنت یا این مخاطب در این پست، پاسخ خصوصی قبلاً اقدام شده است؛ وضعیت را بررسی کنید'
          : 'پاسخ خصوصی برای این گفتگو در دسترس نیست', 409)
  }
  const member = await db.workspaceMember.findFirst({
    where: { workspaceId: auth.workspaceId, userId: auth.userId }, select: { id: true },
  })
  if (!member) throw new PrivateCommentReplyError('not_member', 'عضویت فضای کار یافت نشد', 403)
  if (thread.lockedById && thread.lockedById !== member.id &&
      thread.lockExpiresAt && thread.lockExpiresAt > now) {
    throw new PrivateCommentReplyError('claimed_by_other', 'این گفتگو در اختیار هم‌تیمی دیگری است', 409)
  }

  let claimId: string
  try {
    const claim = await db.commentDmLog.create({ data: {
      workspaceId: auth.workspaceId, ruleId: `manual-inbox:${thread.id}`,
      commentId, postId, senderUserId: root.senderExternalId,
      claimPlatformId: thread.platformId, status: 'pending', sentAt: now,
    } })
    claimId = claim.id
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      throw new PrivateCommentReplyError('already_attempted',
        'پاسخ خصوصی هم‌زمان از مسیر دیگری ثبت شد؛ پیش از هر اقدامی وضعیت اینستاگرام را بررسی کنید', 409)
    }
    throw error
  }

  let receipt: string | null
  try {
    receipt = await send(thread.platform.providerAccountId, postId, commentId, text)
  } catch {
    await db.commentDmLog.update({ where: { id: claimId }, data: {
      status: 'unknown', errorCode: 'private_reply_outcome_unknown',
    } }).catch(() => undefined)
    throw new PrivateCommentReplyError('outcome_unknown',
      'نتیجهٔ ارسال پیام خصوصی نامشخص است؛ برای جلوگیری از ارسال تکراری، گفتگو را در اینستاگرام بررسی کنید', 409)
  }
  if (!receipt) {
    await db.commentDmLog.update({ where: { id: claimId }, data: {
      status: 'unknown', errorCode: 'missing_private_reply_receipt',
    } }).catch(() => undefined)
    throw new PrivateCommentReplyError('outcome_unknown',
      'رسید پیام خصوصی دریافت نشد؛ پیش از ارسال دوباره گفتگو را در اینستاگرام بررسی کنید', 409)
  }

  await db.$transaction(async (tx) => {
    await tx.commentDmLog.update({ where: { id: claimId }, data: {
      status: 'sent', providerMessageId: receipt, sentAt: now,
    } })
    await tx.inboxThreadMessage.createMany({ data: [{
      threadId, workspaceId: auth.workspaceId, platformId: thread.platformId,
      providerMessageId: `private:${receipt}`, direction: 'outbound', messageType: 'dm',
      senderName: thread.platform.name, body: text, createdAt: now,
      payload: { source: 'zernio', replyKind: 'private_comment_reply', commentId, postId,
        deliveryStatus: 'accepted' },
    }], skipDuplicates: true })
    await tx.inboxThread.updateMany({
      where: { id: threadId, workspaceId: auth.workspaceId, firstResponseAt: null },
      data: { firstResponseAt: now },
    })
    await tx.inboxThread.update({ where: { id: threadId }, data: {
      status: 'in_progress', lastMessageAt: now,
    } })
    await tx.$executeRaw`
      UPDATE "InboxThread" SET "tags" = array_remove("tags", 'unanswered')
      WHERE "id" = ${threadId} AND "workspaceId" = ${auth.workspaceId}
    `
  })
  return { status: 'sent', providerMessageId: receipt }
}
