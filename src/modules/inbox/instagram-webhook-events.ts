import { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import {
  buildProviderWebhookEventKey,
  summarizeInstagramWebhookPayload,
} from './instagram-webhook'

export type StoredInstagramWebhookEvent = {
  id: string
  eventKey: string
  duplicate: boolean
  duplicateCount: number
}

export async function storeInstagramWebhookEvent(input: {
  rawBody: string
  signature: string | null
  payload: unknown
}): Promise<StoredInstagramWebhookEvent> {
  const summary = summarizeInstagramWebhookPayload(input.payload)
  const eventKey = buildProviderWebhookEventKey('instagram', input.rawBody)
  const now = new Date()

  const row = await db.providerWebhookEvent.upsert({
    where: { eventKey },
    create: {
      provider: 'instagram',
      eventKey,
      providerObject: summary.object,
      providerAccountId: summary.providerAccountId,
      payload: input.payload as Prisma.InputJsonValue,
      rawBody: input.rawBody,
      signature: input.signature,
      entryCount: summary.entryCount,
      status: 'received',
      lastReceivedAt: now,
    },
    update: {
      signature: input.signature,
      lastReceivedAt: now,
      duplicateCount: { increment: 1 },
    },
    select: {
      id: true,
      eventKey: true,
      duplicateCount: true,
    },
  })

  return {
    id: row.id,
    eventKey: row.eventKey,
    duplicate: row.duplicateCount > 0,
    duplicateCount: row.duplicateCount,
  }
}
