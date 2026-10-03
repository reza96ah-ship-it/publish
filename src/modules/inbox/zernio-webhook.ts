import { db } from '@/lib/db'
import { logger } from '@/lib/logger'

type JsonObject = Record<string, unknown>

function obj(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null
}

function str(value: unknown, max = 500): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= max ? value : null
}

function date(value: unknown): Date {
  const parsed = typeof value === 'string' ? new Date(value) : new Date()
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

export function zernioWebhookAccountId(payload: JsonObject): string | null {
  const account = obj(payload.account)
  return str(account?.accountId) ?? str(account?.id)
}

async function ingestMessage(payload: JsonObject, platformId: string, workspaceId: string) {
  const message = obj(payload.message)
  const conversation = obj(payload.conversation)
  if (!message || message.platform !== 'instagram' || !conversation) return
  const conversationId = str(conversation.platformConversationId) ?? str(conversation.id)
  const messageId = str(message.id)
  if (!conversationId || !messageId) return
  const direction = message.direction === 'outgoing' ? 'outbound' : 'inbound'
  const sentAt = date(message.sentAt)
  const sender = obj(message.sender)
  const existing = await db.inboxThread.findUnique({
    where: { platformId_providerThreadId: { platformId, providerThreadId: conversationId } },
    select: { id: true, lastMessageAt: true, lastInboundAt: true },
  })
  const thread = await db.inboxThread.upsert({
    where: { platformId_providerThreadId: { platformId, providerThreadId: conversationId } },
    create: {
      workspaceId, platformId, providerThreadId: conversationId,
      providerUserId: str(conversation.participantId) ?? str(sender?.id),
      title: str(conversation.participantName, 200) ?? 'Instagram user',
      messageType: 'dm', unreadCount: 0,
      lastMessageAt: sentAt,
      lastInboundAt: direction === 'inbound' ? sentAt : null,
      slaStartedAt: sentAt,
    },
    update: {
      title: str(conversation.participantName, 200) ?? 'Instagram user',
      lastMessageAt: existing && existing.lastMessageAt > sentAt ? existing.lastMessageAt : sentAt,
      lastInboundAt: direction === 'inbound' && (!existing?.lastInboundAt || existing.lastInboundAt < sentAt)
        ? sentAt : existing?.lastInboundAt ?? null,
    },
    select: { id: true },
  })
  const inserted = await db.inboxThreadMessage.createMany({
    data: [{
      threadId: thread.id, workspaceId, platformId, providerMessageId: messageId,
      direction, messageType: 'dm',
      senderExternalId: direction === 'inbound' ? str(sender?.id) : null,
      senderName: str(sender?.name, 200) ?? '',
      body: str(message.text, 10_000) ?? (Array.isArray(message.attachments) && message.attachments.length ? 'رسانه دریافت شد' : ''),
      payload: { source: 'zernio', attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0 },
      createdAt: sentAt,
    }],
    skipDuplicates: true,
  })
  if (direction === 'inbound' && inserted.count) {
    await db.inboxThread.update({ where: { id: thread.id }, data: { unreadCount: { increment: inserted.count } } })
  }
}

async function ingestComment(payload: JsonObject, platformId: string, workspaceId: string) {
  const comment = obj(payload.comment)
  if (!comment || comment.platform !== 'instagram') return
  const commentId = str(comment.id)
  const postId = str(comment.platformPostId)
  if (!commentId || !postId) return
  const author = obj(comment.author)
  if (author?.isOwnAccount === true) return
  const rootId = str(comment.parentCommentId) ?? commentId
  const providerThreadId = `comment:${rootId}`
  const createdAt = date(comment.createdAt)
  const existing = await db.inboxThread.findUnique({
    where: { platformId_providerThreadId: { platformId, providerThreadId } },
    select: { id: true, lastMessageAt: true, lastInboundAt: true },
  })
  const thread = await db.inboxThread.upsert({
    where: { platformId_providerThreadId: { platformId, providerThreadId } },
    create: {
      workspaceId, platformId, providerThreadId,
      providerUserId: str(author?.id),
      title: str(author?.name, 200) ?? str(author?.username, 200) ?? 'Instagram user',
      messageType: 'comment', unreadCount: 0,
      lastMessageAt: createdAt, lastInboundAt: createdAt, slaStartedAt: createdAt,
    },
    update: {
      lastMessageAt: existing && existing.lastMessageAt > createdAt ? existing.lastMessageAt : createdAt,
      lastInboundAt: existing?.lastInboundAt && existing.lastInboundAt > createdAt ? existing.lastInboundAt : createdAt,
    },
    select: { id: true },
  })
  const inserted = await db.inboxThreadMessage.createMany({
    data: [{
      threadId: thread.id, workspaceId, platformId, providerMessageId: `comment:${commentId}`,
      direction: 'inbound', messageType: 'comment',
      senderExternalId: str(author?.id),
      senderName: str(author?.name, 200) ?? str(author?.username, 200) ?? '',
      body: str(comment.text, 10_000) ?? '',
      payload: { source: 'zernio', postId, commentId, authorPicture: str(author?.picture, 2048) },
      createdAt,
    }],
    skipDuplicates: true,
  })
  if (inserted.count) {
    await db.inboxThread.update({ where: { id: thread.id }, data: { unreadCount: { increment: inserted.count } } })
  }
}

export async function processZernioWebhookEvent(eventKey: string): Promise<boolean> {
  const claimed = await db.providerWebhookEvent.updateMany({
    where: { eventKey, provider: 'zernio', status: { in: ['received', 'failed'] } },
    data: { status: 'processing' },
  })
  if (!claimed.count) return false
  const event = await db.providerWebhookEvent.findUnique({ where: { eventKey } })
  const payload = obj(event?.payload)
  if (!event || !payload) return false
  const accountId = zernioWebhookAccountId(payload)
  const platform = accountId ? await db.platform.findUnique({
    where: { provider_providerAccountId: { provider: 'zernio', providerAccountId: accountId } },
    select: { id: true, workspaceId: true },
  }) : null
  if (!platform) {
    await db.providerWebhookEvent.update({ where: { eventKey }, data: { status: 'received' } })
    return false
  }
  try {
    if (payload.event === 'message.received' || payload.event === 'message.sent') {
      await ingestMessage(payload, platform.id, platform.workspaceId)
    } else if (payload.event === 'comment.received') {
      await ingestComment(payload, platform.id, platform.workspaceId)
    }
    await db.providerWebhookEvent.update({ where: { eventKey }, data: { status: 'processed', processedAt: new Date(), lastError: null } })
    return true
  } catch (error) {
    await db.providerWebhookEvent.update({ where: { eventKey }, data: { status: 'failed', lastError: error instanceof Error ? error.name : 'internal_error' } })
    throw error
  }
}

export async function processPendingZernioWebhookEvents(accountIds: string[]): Promise<void> {
  if (accountIds.length === 0) return
  const events = await db.providerWebhookEvent.findMany({
    where: { provider: 'zernio', providerAccountId: { in: accountIds }, status: { in: ['received', 'failed'] } },
    select: { eventKey: true }, orderBy: { receivedAt: 'asc' }, take: 100,
  })
  for (const event of events) {
    try { await processZernioWebhookEvent(event.eventKey) }
    catch (error) { logger.warn({ msg: 'Zernio webhook replay failed', code: error instanceof Error ? error.name : 'internal_error' }) }
  }
}
