import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import { INSTAGRAM_INBOX_API_LIMITS } from '../../../shared/instagram-graph'
import {
  extractInstagramInboxEvents,
  type NormalizedInstagramInboxEvent,
} from './instagram-webhook-normalize'
import { emitInboxThreadEvent } from './realtime-emit'

export type InstagramWebhookIngestResult = {
  extractedEvents: number
  matchedPlatforms: number
  createdThreads: number
  createdThreadMessages: number
  createdInboxMessages: number
  duplicateMessages: number
  unmatchedEvents: number
}

function toJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue
}

function threadMessagePayload(event: NormalizedInstagramInboxEvent): Prisma.InputJsonObject {
  return {
    source: 'instagram_webhook',
    original: toJsonValue(event.payload),
    attachments: event.attachments.map((attachment) => ({
      type: attachment.type,
      title: attachment.title,
      url: attachment.url,
      providerId: attachment.providerId,
    })),
    providerLimits: {
      privateReplyWindowDays: INSTAGRAM_INBOX_API_LIMITS.privateReplyWindowDays,
      conversationMessageReadLimit: INSTAGRAM_INBOX_API_LIMITS.conversationMessageReadLimit,
      commentListLimit: INSTAGRAM_INBOX_API_LIMITS.commentListLimit,
      webhookFirstEvents: [...INSTAGRAM_INBOX_API_LIMITS.webhookFirstEvents],
    },
  }
}

async function ingestEventForPlatform(
  event: NormalizedInstagramInboxEvent,
  platform: { id: string; workspaceId: string }
): Promise<Pick<InstagramWebhookIngestResult, 'createdThreads' | 'createdThreadMessages' | 'createdInboxMessages' | 'duplicateMessages'>> {
  const existingThread = await db.inboxThread.findUnique({
    where: {
      platformId_providerThreadId: {
        platformId: platform.id,
        providerThreadId: event.providerThreadId,
      },
    },
    select: { id: true },
  })

  const outcome = await db.$transaction(async (tx) => {
    const thread = await tx.inboxThread.upsert({
      where: {
        platformId_providerThreadId: {
          platformId: platform.id,
          providerThreadId: event.providerThreadId,
        },
      },
      create: {
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        providerThreadId: event.providerThreadId,
        providerUserId: event.providerUserId,
        title: event.senderName,
        messageType: event.messageType,
        lastMessageAt: event.createdAt,
        lastInboundAt: event.createdAt,
        slaStartedAt: event.createdAt,
      },
      update: {
        title: event.senderName,
        providerUserId: event.providerUserId,
      },
      select: {
        id: true,
        status: true,
        unreadCount: true,
        lastMessageAt: true,
        lastInboundAt: true,
        slaStartedAt: true,
        firstResponseAt: true,
        resolvedAt: true,
      },
    })

    const inserted = await tx.inboxThreadMessage.createMany({
      data: [{
        threadId: thread.id,
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        providerMessageId: event.providerMessageId,
        direction: 'inbound',
        messageType: event.messageType,
        senderExternalId: event.providerUserId,
        senderName: event.senderName,
        body: event.body,
        payload: threadMessagePayload(event),
        createdAt: event.createdAt,
      }],
      skipDuplicates: true,
    })
    if (inserted.count === 0) return { threadId: thread.id, duplicate: true, legacyCount: 0 }

    const startsNewCycle = Boolean(
      (thread.firstResponseAt && event.createdAt > thread.firstResponseAt) ||
      (thread.resolvedAt && event.createdAt > thread.resolvedAt)
    )
    const requiresAttention = thread.firstResponseAt === null || startsNewCycle
    const lastMessageAt = event.createdAt > thread.lastMessageAt ? event.createdAt : thread.lastMessageAt
    const lastInboundAt =
      !thread.lastInboundAt || event.createdAt > thread.lastInboundAt
        ? event.createdAt
        : thread.lastInboundAt
    const slaStartedAt = startsNewCycle
      ? event.createdAt
      : thread.firstResponseAt === null && event.createdAt < thread.slaStartedAt
        ? event.createdAt
        : thread.slaStartedAt

    await tx.inboxThread.update({
      where: { id: thread.id },
      data: {
        lastMessageAt,
        lastInboundAt,
        slaStartedAt,
        ...(requiresAttention
          ? {
              status: 'new',
              unreadCount: { increment: 1 },
              firstResponseAt: startsNewCycle ? null : thread.firstResponseAt,
              resolvedAt: null,
            }
          : {}),
      },
    })

    const legacy = await tx.inboxMessage.createMany({
      data: [{
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        senderName: event.senderName,
        message: event.body,
        platformType: 'instagram',
        externalId: event.providerMessageId,
        messageType: event.messageType,
        isRead: !requiresAttention,
        status: requiresAttention ? 'new' : thread.status,
        slaStartedAt,
        firstResponseAt: requiresAttention ? null : thread.firstResponseAt,
        createdAt: event.createdAt,
      }],
      skipDuplicates: true,
    })

    return { threadId: thread.id, duplicate: false, legacyCount: legacy.count }
  })

  if (!outcome.duplicate) {
    void emitInboxThreadEvent(platform.workspaceId, {
      threadId: outcome.threadId,
      kind: existingThread ? 'message' : 'created',
      messageType: event.messageType,
      senderName: event.senderName,
      preview: event.body.slice(0, 120),
    })
  }

  return {
    createdThreads: existingThread ? 0 : 1,
    createdThreadMessages: outcome.duplicate ? 0 : 1,
    createdInboxMessages: outcome.legacyCount,
    duplicateMessages: outcome.duplicate ? 1 : 0,
  }
}

export async function ingestInstagramWebhookPayload(
  payload: unknown
): Promise<InstagramWebhookIngestResult> {
  const events = extractInstagramInboxEvents(payload)
  const accountIds = [...new Set(events.map((event) => event.providerAccountId))]

  const platforms =
    accountIds.length === 0
      ? []
      : await db.platform.findMany({
          where: {
            type: 'instagram',
            targetId: { in: accountIds },
          },
          select: { id: true, workspaceId: true, targetId: true },
        })

  const platformsByTargetId = new Map<string, typeof platforms>()
  for (const platform of platforms) {
    if (!platform.targetId) continue
    const list = platformsByTargetId.get(platform.targetId) ?? []
    list.push(platform)
    platformsByTargetId.set(platform.targetId, list)
  }

  const result: InstagramWebhookIngestResult = {
    extractedEvents: events.length,
    matchedPlatforms: platforms.length,
    createdThreads: 0,
    createdThreadMessages: 0,
    createdInboxMessages: 0,
    duplicateMessages: 0,
    unmatchedEvents: 0,
  }

  for (const event of events) {
    const matchedPlatforms = platformsByTargetId.get(event.providerAccountId) ?? []
    if (matchedPlatforms.length === 0) {
      result.unmatchedEvents++
      continue
    }

    for (const platform of matchedPlatforms) {
      const partial = await ingestEventForPlatform(event, platform)
      result.createdThreads += partial.createdThreads
      result.createdThreadMessages += partial.createdThreadMessages
      result.createdInboxMessages += partial.createdInboxMessages
      result.duplicateMessages += partial.duplicateMessages
    }
  }

  return result
}
