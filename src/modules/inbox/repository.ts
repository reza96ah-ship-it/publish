import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { randomUUID } from 'crypto'
import { getReplyWindowExpiry } from '../../../shared/instagram-graph'
import type {
  InboxThreadAttachment,
  InboxListQuery,
  InboxMessage,
  InboxThreadDetail,
  InboxThreadMessage,
  InboxThreadSummary,
  InboxThreadListQuery,
  InboxThreadQueue,
  InboxThreadQueueCounts,
} from './types'

function toMessage(m: {
  id: string
  senderName: string | null
  senderAvatar: string | null
  message: string | null
  isRead: boolean
  isReplied: boolean
  reply: string | null
  platformType: string
  messageType: string | null
  assigneeId: string | null
  status: string
  slaStartedAt: Date | null
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  platform: { type: string; name: string } | null
}): InboxMessage {
  return {
    id: m.id,
    senderName: m.senderName,
    senderAvatar: m.senderAvatar,
    message: m.message,
    isRead: m.isRead,
    isReplied: m.isReplied,
    reply: m.reply,
    platform: m.platform?.type ?? m.platformType,
    platformName: m.platform?.name ?? m.platformType,
    messageType: m.messageType,
    assigneeId: m.assigneeId,
    status: m.status,
    slaStartedAt: m.slaStartedAt,
    firstResponseAt: m.firstResponseAt,
    resolvedAt: m.resolvedAt,
    createdAt: m.createdAt,
  }
}

type ThreadMessageRow = {
  id: string
  providerMessageId: string
  direction: string
  messageType: string
  senderExternalId: string | null
  senderName: string
  body: string
  payload: Prisma.JsonValue
  createdAt: Date
}

type MemberRef = {
  id: string
  name: string
  avatarUrl: string | null
}

type ThreadSummaryRow = {
  id: string
  providerThreadId: string
  providerUserId: string | null
  title: string
  messageType: string
  status: string
  assigneeId: string | null
  assignedAt: Date | null
  priority: string
  tags: string[]
  lockedById: string | null
  lockedAt: Date | null
  lockExpiresAt: Date | null
  unreadCount: number
  lastMessageAt: Date
  lastInboundAt: Date | null
  slaStartedAt: Date
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  platform: { type: string; name: string } | null
  assignee: MemberRef | null
  lockedBy: MemberRef | null
  messages: ThreadMessageRow[]
}

type ThreadCursor = { id: string; lastMessageAt: string }
type ThreadMessageCursor = { id: string; createdAt: string }

export function encodeThreadCursor(thread: Pick<InboxThreadSummary, 'id' | 'lastMessageAt'>): string {
  return Buffer.from(
    JSON.stringify({ id: thread.id, lastMessageAt: thread.lastMessageAt.toISOString() })
  ).toString('base64url')
}

function decodeThreadCursor(value: string): ThreadCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<ThreadCursor>
    if (!parsed.id || !parsed.lastMessageAt || Number.isNaN(Date.parse(parsed.lastMessageAt))) {
      return null
    }
    return { id: parsed.id, lastMessageAt: parsed.lastMessageAt }
  } catch {
    return null
  }
}

export function encodeThreadMessageCursor(
  message: Pick<InboxThreadMessage, 'id' | 'createdAt'>
): string {
  return Buffer.from(
    JSON.stringify({ id: message.id, createdAt: message.createdAt.toISOString() })
  ).toString('base64url')
}

function decodeThreadMessageCursor(value: string): ThreadMessageCursor | null {
  try {
    const parsed = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8')
    ) as Partial<ThreadMessageCursor>
    if (!parsed.id || !parsed.createdAt || Number.isNaN(Date.parse(parsed.createdAt))) return null
    return { id: parsed.id, createdAt: parsed.createdAt }
  } catch {
    return null
  }
}

function asJsonRecord(value: Prisma.JsonValue): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null
}

function stringFromJson(value: Prisma.JsonValue | undefined): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function toThreadAttachments(payload: Prisma.JsonValue): InboxThreadAttachment[] {
  const root = asJsonRecord(payload)
  const attachments = Array.isArray(root?.attachments) ? root.attachments : []
  return attachments.flatMap((value) => {
    const record = asJsonRecord(value)
    if (!record) return []
    return {
      type: stringFromJson(record.type) ?? 'attachment',
      title: stringFromJson(record.title) ?? 'Attachment',
      url: stringFromJson(record.url),
      providerId: stringFromJson(record.providerId),
    }
  })
}

function toThreadMessage(message: ThreadMessageRow): InboxThreadMessage {
  return {
    id: message.id,
    providerMessageId: message.providerMessageId,
    direction: message.direction,
    messageType: message.messageType,
    senderExternalId: message.senderExternalId,
    senderName: message.senderName,
    body: message.body,
    attachments: toThreadAttachments(message.payload),
    createdAt: message.createdAt,
  }
}

function toThreadSummary(
  thread: ThreadSummaryRow,
  lastMessage: ThreadMessageRow | null = thread.messages[0] ?? null
): InboxThreadSummary {
  const title =
    thread.title || lastMessage?.senderName || thread.providerUserId || thread.providerThreadId

  return {
    id: thread.id,
    providerThreadId: thread.providerThreadId,
    providerUserId: thread.providerUserId,
    title,
    platform: thread.platform?.type ?? 'instagram',
    platformName: thread.platform?.name ?? 'instagram',
    messageType: thread.messageType,
    status: thread.status,
    assigneeId: thread.assigneeId,
    assigneeName: thread.assignee?.name ?? null,
    assigneeAvatar: thread.assignee?.avatarUrl ?? null,
    priority: thread.priority,
    tags: thread.tags,
    lockedById: thread.lockedById,
    lockedByName: thread.lockedBy?.name ?? null,
    lockExpiresAt: thread.lockExpiresAt,
    unreadCount: thread.unreadCount,
    lastMessageAt: thread.lastMessageAt,
    lastInboundAt: thread.lastInboundAt,
    slaStartedAt: thread.slaStartedAt,
    firstResponseAt: thread.firstResponseAt,
    resolvedAt: thread.resolvedAt,
    // Meta 24h DM messaging-window deadline — the UI shows a countdown and
    // the service refuses sends past it. Null for comment threads: public
    // comment replies have no window (7d only applies to comment→DM).
    replyWindowExpiresAt:
      thread.messageType === 'dm' ? getReplyWindowExpiry('dm', thread.lastInboundAt) : null,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    lastMessage: lastMessage ? toThreadMessage(lastMessage) : null,
  }
}

function toThreadDetail(thread: ThreadSummaryRow): InboxThreadDetail {
  const messages = thread.messages.map(toThreadMessage)
  return {
    ...toThreadSummary(thread, thread.messages[thread.messages.length - 1] ?? null),
    messages,
  }
}

export class InboxRepository {
  async list(workspaceId: string, query: InboxListQuery) {
    const cursorSql = query.cursor
      ? Prisma.sql`AND im."id" < ${query.cursor}`
      : Prisma.empty
    const ids = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT im."id"
      FROM "InboxMessage" im
      WHERE im."workspaceId" = ${workspaceId}
        ${cursorSql}
        AND NOT EXISTS (
          SELECT 1
          FROM "InboxThreadMessage" itm
          WHERE itm."workspaceId" = im."workspaceId"
            AND itm."platformId" = im."platformId"
            AND im."externalId" IS NOT NULL
            AND itm."providerMessageId" = im."externalId"
        )
      ORDER BY im."id" DESC
      LIMIT ${query.limit + 1}
    `)
    if (ids.length === 0) return []

    const rows = await db.inboxMessage.findMany({
      where: { id: { in: ids.map(({ id }) => id) }, workspaceId },
      include: { platform: { select: { type: true, name: true } } },
    })
    const byId = new Map(rows.map((row) => [row.id, row]))
    return ids.flatMap(({ id }) => {
      const row = byId.get(id)
      return row ? [toMessage(row)] : []
    })
  }

  /** Build the where clause for one queue. membershipId powers 'mine'. */
  private threadQueueWhere(
    workspaceId: string,
    queue: InboxThreadQueue,
    membershipId: string | null
  ): Prisma.InboxThreadWhereInput {
    const base: Prisma.InboxThreadWhereInput = { workspaceId }
    switch (queue) {
      case 'unread':
        return { ...base, unreadCount: { gt: 0 } }
      case 'unassigned':
        return { ...base, assigneeId: null, status: { not: 'resolved' } }
      case 'mine':
        // No membership → empty queue (impossible in practice; guards resolve it)
        return { ...base, assigneeId: membershipId ?? '__none__' }
      case 'urgent':
        return { ...base, priority: { in: ['high', 'urgent'] }, status: { not: 'resolved' } }
      case 'comment':
      case 'dm':
      case 'mention':
        return { ...base, messageType: queue }
      case 'resolved':
        return { ...base, status: 'resolved' }
      case 'all':
      default:
        return base
    }
  }

  async listThreads(
    workspaceId: string,
    query: InboxThreadListQuery,
    membershipId: string | null = null
  ) {
    const where = this.threadQueueWhere(workspaceId, query.queue ?? 'all', membershipId)
    if (query.q) {
      where.OR = [
        { title: { contains: query.q, mode: 'insensitive' } },
        { messages: { some: { body: { contains: query.q, mode: 'insensitive' } } } },
      ]
    }
    if (query.cursor) {
      let cursor = decodeThreadCursor(query.cursor)
      if (!cursor) {
        const legacyCursor = await db.inboxThread.findFirst({
          where: { id: query.cursor, workspaceId },
          select: { id: true, lastMessageAt: true },
        })
        cursor = legacyCursor
          ? { id: legacyCursor.id, lastMessageAt: legacyCursor.lastMessageAt.toISOString() }
          : null
      }
      if (!cursor) return []
      const lastMessageAt = new Date(cursor.lastMessageAt)
      where.AND = [
        {
          OR: [
            { lastMessageAt: { lt: lastMessageAt } },
            { lastMessageAt, id: { lt: cursor.id } },
          ],
        },
      ]
    }
    const rows = await db.inboxThread.findMany({
      where,
      include: {
        platform: { select: { type: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        lockedBy: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            providerMessageId: true,
            direction: true,
            messageType: true,
            senderExternalId: true,
            senderName: true,
            body: true,
            payload: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    })
    return rows.map((row) => toThreadSummary(row))
  }

  /** One count per queue for the rail badges. 9 cheap indexed counts. */
  async threadQueueCounts(
    workspaceId: string,
    membershipId: string | null
  ): Promise<InboxThreadQueueCounts> {
    const queues: InboxThreadQueue[] = [
      'all',
      'unread',
      'unassigned',
      'mine',
      'urgent',
      'comment',
      'dm',
      'mention',
      'resolved',
    ]
    const counts = await Promise.all(
      queues.map((queue) =>
        db.inboxThread.count({ where: this.threadQueueWhere(workspaceId, queue, membershipId) })
      )
    )
    return Object.fromEntries(queues.map((q, i) => [q, counts[i]])) as InboxThreadQueueCounts
  }

  async findThreadInWorkspace(id: string, workspaceId: string) {
    return db.inboxThread.findFirst({ where: { id, workspaceId } })
  }

  async getThread(id: string, workspaceId: string) {
    const thread = await db.inboxThread.findFirst({
      where: { id, workspaceId },
      include: {
        platform: { select: { type: true, name: true } },
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        lockedBy: { select: { id: true, name: true, avatarUrl: true } },
        messages: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 100,
          select: {
            id: true,
            providerMessageId: true,
            direction: true,
            messageType: true,
            senderExternalId: true,
            senderName: true,
            body: true,
            payload: true,
            createdAt: true,
          },
        },
      },
    })
    return thread
      ? toThreadDetail({ ...thread, messages: [...thread.messages].reverse() })
      : null
  }

  async findThreadWithPlatform(id: string, workspaceId: string) {
    return db.inboxThread.findFirst({
      where: { id, workspaceId },
      include: {
        platform: {
          select: { id: true, type: true, tokenSecret: true, targetId: true },
        },
        messages: {
          where: { direction: 'inbound' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            providerMessageId: true,
            messageType: true,
            senderExternalId: true,
          },
        },
      },
    })
  }

  async getThreadProviderMessageIds(id: string, workspaceId: string) {
    const messages = await db.inboxThreadMessage.findMany({
      where: { threadId: id, workspaceId },
      select: { providerMessageId: true },
    })
    return messages.map((message) => message.providerMessageId)
  }

  /**
   * Customer context for one thread: how long we've known this sender, and
   * their other conversations in this workspace (matched by providerUserId).
   */
  async getThreadCustomerContext(id: string, workspaceId: string) {
    const thread = await db.inboxThread.findFirst({
      where: { id, workspaceId },
      select: { id: true, providerUserId: true, title: true },
    })
    if (!thread) return null
    if (!thread.providerUserId) {
      return { customer: { name: thread.title, firstSeenAt: null, threadCount: 1 }, priorThreads: [] }
    }

    const relatedWhere = { workspaceId, providerUserId: thread.providerUserId }
    const [summary, related] = await db.$transaction([
      db.inboxThread.aggregate({
        where: relatedWhere,
        _count: { _all: true },
        _min: { createdAt: true },
      }),
      db.inboxThread.findMany({
        where: relatedWhere,
        orderBy: { lastMessageAt: 'desc' },
        select: {
          id: true,
          messageType: true,
          status: true,
          lastMessageAt: true,
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { body: true },
          },
        },
        take: 20,
      }),
    ])

    return {
      customer: {
        name: thread.title,
        firstSeenAt: summary._min.createdAt,
        threadCount: summary._count._all,
      },
      priorThreads: related
        .filter((t) => t.id !== thread.id)
        .map((t) => ({
          id: t.id,
          messageType: t.messageType,
          status: t.status,
          lastMessageAt: t.lastMessageAt,
          preview: t.messages[0]?.body?.slice(0, 80) ?? '',
        })),
    }
  }

  async findInWorkspace(id: string, workspaceId: string) {
    return db.inboxMessage.findFirst({ where: { id, workspaceId } })
  }

  /** Message + the platform credential fields needed to send a real reply. */
  async findWithPlatform(id: string, workspaceId: string) {
    return db.inboxMessage.findFirst({
      where: { id, workspaceId },
      include: {
        platform: { select: { type: true, tokenSecret: true, targetId: true } },
      },
    })
  }

  async findMemberInWorkspace(memberId: string, workspaceId: string) {
    return db.workspaceMember.findFirst({ where: { id: memberId, workspaceId } })
  }

  async findMemberByUserInWorkspace(userId: string, workspaceId: string) {
    return db.workspaceMember.findFirst({ where: { userId, workspaceId } })
  }

  async markRead(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: true } })
  }

  async markUnread(id: string) {
    await db.inboxMessage.update({ where: { id }, data: { isRead: false } })
  }

  async markThreadRead(id: string, workspaceId: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    await db.inboxThread.update({ where: { id }, data: { unreadCount: 0 } })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { isRead: true },
      })
    }
  }

  async markThreadUnread(id: string, workspaceId: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    await db.inboxThread.update({ where: { id }, data: { unreadCount: 1 } })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { isRead: false },
      })
    }
  }

  async setThreadStatus(id: string, workspaceId: string, status: string) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    const updated = await db.inboxThread.update({
      where: { id },
      data: {
        status,
        resolvedAt: status === 'resolved' ? new Date() : null,
      },
      select: { id: true, status: true, resolvedAt: true },
    })
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { status },
      })
    }
    return updated
  }

  async assignThread(id: string, workspaceId: string, assigneeId: string | null) {
    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    const current = await db.inboxThread.findUnique({
      where: { id },
      select: { status: true },
    })
    const isResolved = current?.status === 'resolved'
    const now = new Date()
    const updated = await db.inboxThread.update({
      where: { id },
      data: {
        assigneeId,
        assignedAt: assigneeId ? now : null,
        ...(isResolved ? {} : { status: assigneeId ? 'assigned' : 'new' }),
      },
      select: { id: true, assigneeId: true, status: true, assignedAt: true },
    })

    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: {
          assigneeId,
          ...(isResolved ? {} : { status: assigneeId ? 'assigned' : 'new' }),
        },
      })
    }

    return updated
  }

  async claimThread(id: string, workspaceId: string, memberId: string, leaseMinutes = 10) {
    const now = new Date()
    const lockExpiresAt = new Date(now.getTime() + leaseMinutes * 60_000)
    const result = await db.inboxThread.updateMany({
      where: {
        id,
        workspaceId,
        OR: [
          { lockedById: null },
          { lockExpiresAt: null },
          { lockExpiresAt: { lt: now } },
          { lockedById: memberId },
        ],
      },
      data: {
        assigneeId: memberId,
        assignedAt: now,
        status: 'assigned',
        lockedById: memberId,
        lockedAt: now,
        lockExpiresAt,
      },
    })

    if (result.count === 0) return null

    const providerMessageIds = await this.getThreadProviderMessageIds(id, workspaceId)
    if (providerMessageIds.length > 0) {
      await db.inboxMessage.updateMany({
        where: { workspaceId, externalId: { in: providerMessageIds } },
        data: { assigneeId: memberId, status: 'assigned' },
      })
    }

    return { ok: true, assigneeId: memberId, lockExpiresAt }
  }

  async updateThreadTags(id: string, tags: string[]) {
    return db.inboxThread.update({
      where: { id },
      data: { tags },
      select: { id: true, tags: true },
    })
  }

  async updateThreadPriority(id: string, priority: string) {
    return db.inboxThread.update({
      where: { id },
      data: { priority },
      select: { id: true, priority: true },
    })
  }

  async assign(id: string, assigneeId: string | null) {
    // #208: assigning moves the workflow forward and starts the SLA clock.
    // Un-assigning an unresolved message returns it to `new`.
    const current = await db.inboxMessage.findUnique({
      where: { id },
      select: { status: true, slaStartedAt: true },
    })
    const isResolved = current?.status === 'resolved'
    return db.inboxMessage.update({
      where: { id },
      data: {
        assigneeId,
        ...(isResolved
          ? {}
          : assigneeId
            ? { status: 'assigned', slaStartedAt: current?.slaStartedAt ?? new Date() }
            : { status: 'new' }),
      },
    })
  }

  async reply(id: string, replyText: string) {
    // #208: first reply stamps firstResponseAt for first-response-time metrics.
    const current = await db.inboxMessage.findUnique({
      where: { id },
      select: { firstResponseAt: true },
    })
    return db.inboxMessage.update({
      where: { id },
      data: {
        reply: replyText.trim(),
        isReplied: true,
        isRead: true,
        ...(current?.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      },
    })
  }

  async markLegacyRepliedByExternalId(
    workspaceId: string,
    platformId: string,
    providerMessageId: string,
    replyText: string
  ) {
    const current = await db.inboxMessage.findFirst({
      where: { workspaceId, platformId, externalId: providerMessageId },
      select: { id: true, firstResponseAt: true },
    })
    if (!current) return null
    return db.inboxMessage.update({
      where: { id: current.id },
      data: {
        reply: replyText.trim(),
        isReplied: true,
        isRead: true,
        ...(current.firstResponseAt ? {} : { firstResponseAt: new Date() }),
      },
    })
  }

  async appendThreadReply(
    threadId: string,
    workspaceId: string,
    platformId: string,
    messageType: string,
    replyText: string,
    providerMessageId: string | null = null
  ) {
    const now = new Date()
    return db.$transaction(async (tx) => {
      const threadMessage = await tx.inboxThreadMessage.create({
        data: {
          threadId,
          workspaceId,
          platformId,
          providerMessageId: providerMessageId ?? `outbound:${threadId}:${randomUUID()}`,
          direction: 'outbound',
          messageType,
          senderName: 'You',
          body: replyText.trim(),
          payload: {
            source: 'app-reply',
            providerAcknowledged: true,
            providerMessageId,
          },
          createdAt: now,
        },
      })

      await tx.inboxThread.update({
        where: { id: threadId },
        data: {
          unreadCount: 0,
          status: 'in_progress',
          lastMessageAt: now,
        },
      })
      await tx.inboxThread.updateMany({
        where: { id: threadId, firstResponseAt: null },
        data: { firstResponseAt: now },
      })

      return threadMessage
    })
  }

  async legacyUnreadCount(workspaceId: string): Promise<number> {
    const rows = await db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM "InboxMessage" im
      WHERE im."workspaceId" = ${workspaceId}
        AND im."isRead" = false
        AND NOT EXISTS (
          SELECT 1
          FROM "InboxThreadMessage" itm
          WHERE itm."workspaceId" = im."workspaceId"
            AND itm."platformId" = im."platformId"
            AND im."externalId" IS NOT NULL
            AND itm."providerMessageId" = im."externalId"
        )
    `)
    return rows[0]?.count ?? 0
  }

  async listThreadMessages(id: string, workspaceId: string, query: InboxListQuery) {
    const cursor = query.cursor ? decodeThreadMessageCursor(query.cursor) : null
    if (query.cursor && !cursor) return []
    const createdAt = cursor ? new Date(cursor.createdAt) : null
    const rows = await db.inboxThreadMessage.findMany({
      where: {
        threadId: id,
        workspaceId,
        ...(cursor && createdAt
          ? {
              OR: [
                { createdAt: { lt: createdAt } },
                { createdAt, id: { lt: cursor.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
      select: {
        id: true,
        providerMessageId: true,
        direction: true,
        messageType: true,
        senderExternalId: true,
        senderName: true,
        body: true,
        payload: true,
        createdAt: true,
      },
    })
    return rows.map(toThreadMessage)
  }
}
