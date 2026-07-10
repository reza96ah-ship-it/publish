import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  extractInstagramInboxEvents,
  type NormalizedInstagramInboxEvent,
} from './instagram-webhook-normalize'

export type InstagramWebhookIngestResult = {
  extractedEvents: number
  matchedPlatforms: number
  createdThreads: number
  createdThreadMessages: number
  createdInboxMessages: number
  duplicateMessages: number
  unmatchedEvents: number
}

function isPrismaUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  )
}

async function ingestEventForPlatform(
  event: NormalizedInstagramInboxEvent,
  platform: { id: string; workspaceId: string }
): Promise<Pick<InstagramWebhookIngestResult, 'createdThreads' | 'createdThreadMessages' | 'createdInboxMessages' | 'duplicateMessages'>> {
  let createdThreads = 0
  let createdThreadMessages = 0
  let createdInboxMessages = 0
  let duplicateMessages = 0

  const thread = await db.inboxThread.upsert({
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
    },
    update: {
      title: event.senderName,
      providerUserId: event.providerUserId,
    },
    select: { id: true, createdAt: true },
  })

  if (Math.abs(thread.createdAt.getTime() - Date.now()) < 5_000) {
    createdThreads = 1
  }

  try {
    await db.inboxThreadMessage.create({
      data: {
        threadId: thread.id,
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        providerMessageId: event.providerMessageId,
        direction: 'inbound',
        messageType: event.messageType,
        senderExternalId: event.providerUserId,
        senderName: event.senderName,
        body: event.body,
        payload: event.payload as Prisma.InputJsonValue,
        createdAt: event.createdAt,
      },
    })
    createdThreadMessages = 1

    await db.inboxThread.update({
      where: { id: thread.id },
      data: {
        status: 'new',
        lastMessageAt: event.createdAt,
        unreadCount: { increment: 1 },
      },
    })

    await db.inboxMessage
      .create({
        data: {
          workspaceId: platform.workspaceId,
          platformId: platform.id,
          senderName: event.senderName,
          message: event.body,
          platformType: 'instagram',
          externalId: event.providerMessageId,
          messageType: event.messageType,
          createdAt: event.createdAt,
        },
      })
      .then(() => {
        createdInboxMessages = 1
      })
      .catch((error: unknown) => {
        if (!isPrismaUniqueViolation(error)) throw error
      })
  } catch (error) {
    if (!isPrismaUniqueViolation(error)) throw error
    duplicateMessages = 1
  }

  return { createdThreads, createdThreadMessages, createdInboxMessages, duplicateMessages }
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
