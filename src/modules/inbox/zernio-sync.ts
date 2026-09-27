import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import {
  listZernioInboxConversations,
  listZernioInboxMessages,
  listZernioCommentedPosts,
  listZernioPostComments,
  type ZernioInboxConversation,
  type ZernioInboxMessage,
  type ZernioPostComment,
} from '@/lib/zernio'
import { syncWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'
import { processPendingZernioWebhookEvents } from './zernio-webhook'

const lastSync = new Map<string, number>()
const lastCommentsSync = new Map<string, number>()
const inFlight = new Map<string, Promise<void>>()
const SYNC_INTERVAL_MS = 30_000
const COMMENTS_SYNC_INTERVAL_MS = 10 * 60_000

function validDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

async function syncConversation(
  workspaceId: string,
  platformId: string,
  conversation: ZernioInboxConversation,
) {
  const page = await listZernioInboxMessages(conversation.accountId, conversation.id)
  const messages = page.data
  const latestInbound = messages
    .filter((message) => message.direction === 'incoming')
    .map((message) => validDate(message.createdAt))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  const existing = await db.inboxThread.findUnique({
    where: { platformId_providerThreadId: { platformId, providerThreadId: conversation.id } },
    select: { id: true, lastMessageAt: true, lastInboundAt: true },
  })
  const updatedTime = validDate(conversation.updatedTime) ?? latestInbound ?? new Date()
  const thread = await db.inboxThread.upsert({
    where: { platformId_providerThreadId: { platformId, providerThreadId: conversation.id } },
    create: {
      workspaceId,
      platformId,
      providerThreadId: conversation.id,
      providerUserId: conversation.participantId,
      title: conversation.participantName,
      messageType: 'dm',
      unreadCount: conversation.unreadCount ?? 0,
      lastMessageAt: updatedTime,
      lastInboundAt: latestInbound,
      slaStartedAt: updatedTime,
    },
    update: {
      title: conversation.participantName,
      providerUserId: conversation.participantId,
      lastMessageAt: existing && existing.lastMessageAt > updatedTime ? existing.lastMessageAt : updatedTime,
      lastInboundAt: existing?.lastInboundAt && (!latestInbound || existing.lastInboundAt > latestInbound)
        ? existing.lastInboundAt
        : latestInbound,
    },
    select: { id: true },
  })

  const rows = (direction: ZernioInboxMessage['direction']) => messages
    .filter((message) => message.direction === direction)
    .map((message) => ({
      threadId: thread.id,
      workspaceId,
      platformId,
      providerMessageId: message.id,
      direction: direction === 'incoming' ? 'inbound' : 'outbound',
      messageType: 'dm',
      senderExternalId: direction === 'incoming' ? conversation.participantId : null,
      senderName: message.senderName,
      body: message.message,
      payload: { source: 'zernio', attachmentCount: message.attachmentCount, isDeleted: message.isDeleted },
      createdAt: validDate(message.createdAt) ?? updatedTime,
    }))
  const incoming = await db.inboxThreadMessage.createMany({ data: rows('incoming'), skipDuplicates: true })
  await db.inboxThreadMessage.createMany({ data: rows('outgoing'), skipDuplicates: true })
  if (existing && incoming.count > 0) {
    await db.inboxThread.update({
      where: { id: thread.id },
      data: { unreadCount: { increment: incoming.count } },
    })
  }
}

async function syncCommentThread(
  workspaceId: string,
  platformId: string,
  postId: string,
  comment: ZernioPostComment,
  replies: ZernioPostComment[],
) {
  if (comment.isOwner) return
  const messages = [comment, ...replies]
  const lastMessageAt = messages.map((row) => validDate(row.createdTime)).filter((date): date is Date => date !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? new Date()
  const inboundDate = messages.filter((row) => !row.isOwner).map((row) => validDate(row.createdTime))
    .filter((date): date is Date => date !== null).sort((a, b) => b.getTime() - a.getTime())[0] ?? null
  const providerThreadId = `comment:${comment.id}`
  const existing = await db.inboxThread.findUnique({
    where: { platformId_providerThreadId: { platformId, providerThreadId } },
    select: { id: true, lastMessageAt: true, lastInboundAt: true },
  })
  const thread = await db.inboxThread.upsert({
    where: { platformId_providerThreadId: { platformId, providerThreadId } },
    create: {
      workspaceId, platformId, providerThreadId,
      providerUserId: comment.authorId,
      title: comment.authorName,
      messageType: 'comment',
      unreadCount: 1,
      lastMessageAt,
      lastInboundAt: inboundDate,
      slaStartedAt: lastMessageAt,
    },
    update: {
      title: comment.authorName,
      lastMessageAt: existing && existing.lastMessageAt > lastMessageAt ? existing.lastMessageAt : lastMessageAt,
      lastInboundAt: existing?.lastInboundAt && (!inboundDate || existing.lastInboundAt > inboundDate)
        ? existing.lastInboundAt : inboundDate,
    },
    select: { id: true },
  })
  const rows = messages.map((row) => ({
    threadId: thread.id,
    workspaceId,
    platformId,
    providerMessageId: `comment:${row.id}`,
    direction: row.isOwner ? 'outbound' : 'inbound',
    messageType: 'comment',
    senderExternalId: row.isOwner ? null : row.authorId,
    senderName: row.authorName,
    body: row.message,
    payload: { source: 'zernio', postId, commentId: row.id },
    createdAt: validDate(row.createdTime) ?? lastMessageAt,
  }))
  const inbound = await db.inboxThreadMessage.createMany({ data: rows.filter((row) => row.direction === 'inbound'), skipDuplicates: true })
  await db.inboxThreadMessage.createMany({ data: rows.filter((row) => row.direction === 'outbound'), skipDuplicates: true })
  if (existing && inbound.count > 0) {
    await db.inboxThread.update({ where: { id: thread.id }, data: { unreadCount: { increment: inbound.count } } })
  }
}

async function syncComments(workspaceId: string, profileId: string, platformIds: Map<string | null, string>) {
  if (Date.now() - (lastCommentsSync.get(workspaceId) ?? 0) < COMMENTS_SYNC_INTERVAL_MS) return
  const posts = (await listZernioCommentedPosts(profileId)).slice(0, 12)
  for (let index = 0; index < posts.length; index += 4) {
    await Promise.all(posts.slice(index, index + 4).map(async (post) => {
      const platformId = platformIds.get(post.accountId)
      if (!platformId) return
      try {
        const comments = await listZernioPostComments(post.accountId, post.id)
        for (const comment of comments.filter((row) => !row.parentId)) {
          await syncCommentThread(workspaceId, platformId, post.id, comment, comments.filter((row) => row.parentId === comment.id))
        }
      } catch (error) {
        logger.warn({ msg: 'Zernio comment sync failed', code: error instanceof Error ? error.name : 'internal_error' })
      }
    }))
  }
  lastCommentsSync.set(workspaceId, Date.now())
}

/** Reconcile recent provider data into the existing Inbox, never a second queue. */
async function performSync(workspaceId: string): Promise<void> {
  try {
    const accounts = (await syncWorkspaceZernioInstagram(workspaceId)).filter((account) => account.isActive)
    if (accounts.length === 0) return
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { zernioProfileId: true },
    })
    if (!workspace?.zernioProfileId) return
    const allowedIds = new Set(accounts.map((account) => account.id))
    await processPendingZernioWebhookEvents([...allowedIds])
    const page = await listZernioInboxConversations(workspace.zernioProfileId)
    const conversations = page.data.filter((row) => allowedIds.has(row.accountId)).slice(0, 20)
    const platforms = await db.platform.findMany({
      where: { workspaceId, provider: 'zernio', providerAccountId: { in: [...allowedIds] } },
      select: { id: true, providerAccountId: true },
    })
    const platformIds = new Map(platforms.map((platform) => [platform.providerAccountId, platform.id]))
    for (let index = 0; index < conversations.length; index += 4) {
      await Promise.all(conversations.slice(index, index + 4).map(async (conversation) => {
        const platformId = platformIds.get(conversation.accountId)
        if (!platformId) return
        try {
          await syncConversation(workspaceId, platformId, conversation)
        } catch (error) {
          logger.warn({ msg: 'Zernio conversation sync failed', code: error instanceof Error ? error.name : 'internal_error' })
        }
      }))
    }
    try {
      await syncComments(workspaceId, workspace.zernioProfileId, platformIds)
    } catch (error) {
      logger.warn({ msg: 'Zernio commented posts unavailable', code: error instanceof Error ? error.name : 'internal_error' })
    }
    lastSync.set(workspaceId, Date.now())
  } catch (error) {
    logger.warn({ msg: 'Zernio Inbox sync unavailable', code: error instanceof Error ? error.name : 'internal_error' })
  }
}

export async function syncWorkspaceZernioInbox(workspaceId: string): Promise<void> {
  if (Date.now() - (lastSync.get(workspaceId) ?? 0) < SYNC_INTERVAL_MS) return
  const pending = inFlight.get(workspaceId)
  if (pending) return pending
  const operation = performSync(workspaceId).finally(() => inFlight.delete(workspaceId))
  inFlight.set(workspaceId, operation)
  return operation
}
