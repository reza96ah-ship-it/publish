/**
 * Instagram DM history backfill — runs once when an account is connected.
 *
 * Webhooks only deliver events from the moment of subscription; without a
 * backfill a freshly connected account shows an empty inbox even when real
 * customer conversations exist. The Conversations API exposes only the 20
 * most recent messages per conversation (documented Meta limit — see
 * INSTAGRAM_INBOX_API_LIMITS.conversationMessageReadLimit), so this is a
 * best-effort seed of recent history, not a full import.
 *
 * Threads use the same providerThreadId convention as the webhook ingest
 * (`dm:{customer IGSID}`), so webhook events that arrive later land in the
 * same thread. Message inserts dedup on @@unique([platformId,
 * providerMessageId]) — re-running the backfill is a no-op.
 *
 * Backfilled threads keep unreadCount 0: this is history the account owner
 * has already seen on Instagram, not new work for the inbox queue.
 */

import { db } from '@/lib/db'
import { decrypt } from '@/lib/crypto'
import {
  getInstagramGraphApiBaseUrl,
  INSTAGRAM_INBOX_API_LIMITS,
} from '../../../shared/instagram-graph'

const CONVERSATIONS_PER_ACCOUNT = 10
const TIMEOUT_MS = 20_000

interface IgConversationMessage {
  id: string
  message?: string
  from?: { id: string; username?: string }
  created_time?: string
}

interface IgConversation {
  id: string
  participants?: { data?: { id: string; username?: string }[] }
  messages?: { data?: IgConversationMessage[] }
}

export interface BackfillStats {
  conversations: number
  threadsCreated: number
  messagesCreated: number
  errors: number
}

export type FetchConversationsFn = (
  accessToken: string,
  igUserId: string
) => Promise<IgConversation[]>

/** Fetch recent conversations + their last messages from the Graph API. */
export async function fetchInstagramConversations(
  accessToken: string,
  igUserId: string
): Promise<IgConversation[]> {
  const limit = INSTAGRAM_INBOX_API_LIMITS.conversationMessageReadLimit
  const params = new URLSearchParams({
    platform: 'instagram',
    fields: `participants,messages.limit(${limit}){id,from,message,created_time}`,
    limit: String(CONVERSATIONS_PER_ACCOUNT),
    access_token: accessToken,
  })
  const res = await fetch(`${getInstagramGraphApiBaseUrl()}/${igUserId}/conversations?${params}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const data = (await res.json().catch(() => null)) as {
    error?: { message?: string }
    data?: IgConversation[]
  } | null
  if (!res.ok || !data || data.error) {
    throw new Error(`IG conversations fetch failed: ${data?.error?.message ?? 'unknown error'}`)
  }
  return data.data ?? []
}

/**
 * Backfill one platform's recent DM history into InboxThread rows.
 * Best-effort: errors are counted and logged, never thrown — the caller
 * (OAuth connect) must not fail because history couldn't be read.
 */
export async function backfillInstagramConversations(
  platformId: string,
  deps: { fetchConversations?: FetchConversationsFn } = {}
): Promise<BackfillStats> {
  const stats: BackfillStats = { conversations: 0, threadsCreated: 0, messagesCreated: 0, errors: 0 }
  const fetchFn = deps.fetchConversations ?? fetchInstagramConversations

  const platform = await db.platform.findUnique({
    where: { id: platformId },
    select: { id: true, workspaceId: true, type: true, tokenSecret: true, targetId: true },
  })
  if (
    !platform ||
    platform.type !== 'instagram' ||
    !platform.tokenSecret ||
    !platform.targetId
  ) {
    return stats
  }
  const igUserId = platform.targetId

  let conversations: IgConversation[]
  try {
    conversations = await fetchFn(decrypt(platform.tokenSecret), igUserId)
  } catch (err) {
    console.error(
      `[inbox-backfill] platform ${platformId}: conversations fetch failed (non-fatal):`,
      (err as Error).message
    )
    stats.errors++
    return stats
  }

  for (const conversation of conversations) {
    stats.conversations++
    try {
      const created = await ingestConversation(platform.workspaceId, platform.id, igUserId, conversation)
      stats.threadsCreated += created.threadCreated ? 1 : 0
      stats.messagesCreated += created.messagesCreated
    } catch (err) {
      console.error(
        `[inbox-backfill] conversation ${conversation.id}: ingest failed:`,
        (err as Error).message
      )
      stats.errors++
    }
  }

  if (stats.messagesCreated > 0) {
    console.log(
      `[inbox-backfill] platform ${platformId}: conversations:${stats.conversations} threads:${stats.threadsCreated} messages:${stats.messagesCreated}`
    )
  }
  return stats
}

async function ingestConversation(
  workspaceId: string,
  platformId: string,
  igUserId: string,
  conversation: IgConversation
): Promise<{ threadCreated: boolean; messagesCreated: number }> {
  const customer = (conversation.participants?.data ?? []).find((p) => p.id !== igUserId)
  const messages = conversation.messages?.data ?? []
  if (!customer || messages.length === 0) return { threadCreated: false, messagesCreated: 0 }

  const customerName = customer.username ?? 'کاربر اینستاگرام'
  const inboundTimes = messages
    .filter((m) => m.from?.id === customer.id)
    .map((m) => safeDate(m.created_time))
  const newestInboundAt = inboundTimes.length
    ? new Date(Math.max(...inboundTimes.map((d) => d.getTime())))
    : null
  const datedMessages = messages.map((message) => ({
    message,
    createdAt: safeDate(message.created_time),
  }))
  const newestAt = new Date(Math.max(...datedMessages.map(({ createdAt }) => createdAt.getTime())))
  const firstResponseAt = newestInboundAt
    ? (datedMessages
        .filter(
          ({ message, createdAt }) =>
            message.from?.id !== customer.id && createdAt >= newestInboundAt
        )
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0]?.createdAt ?? null)
    : null
  const providerThreadId = `dm:${customer.id}`

  return db.$transaction(async (tx) => {
    const existing = await tx.inboxThread.findUnique({
      where: { platformId_providerThreadId: { platformId, providerThreadId } },
      select: {
        id: true,
        lastMessageAt: true,
        lastInboundAt: true,
        slaStartedAt: true,
        firstResponseAt: true,
      },
    })
    const thread = await tx.inboxThread.upsert({
      where: { platformId_providerThreadId: { platformId, providerThreadId } },
      create: {
        workspaceId,
        platformId,
        providerThreadId,
        providerUserId: customer.id,
        title: customerName,
        messageType: 'dm',
        lastMessageAt: newestAt,
        lastInboundAt: newestInboundAt,
        slaStartedAt: newestInboundAt ?? newestAt,
        firstResponseAt,
      },
      update: {
        providerUserId: customer.id,
        title: customerName,
      },
      select: { id: true },
    })

    const inserted = await tx.inboxThreadMessage.createMany({
      data: datedMessages.map(({ message, createdAt }) => {
        const inbound = message.from?.id === customer.id
        return {
          threadId: thread.id,
          workspaceId,
          platformId,
          providerMessageId: message.id,
          direction: inbound ? 'inbound' : 'outbound',
          messageType: 'dm',
          senderExternalId: message.from?.id ?? null,
          senderName: inbound ? customerName : (message.from?.username ?? 'شما'),
          body: message.message ?? '',
          payload: {
            source: 'connect-backfill',
            conversationId: conversation.id,
            timestamp: message.created_time ?? null,
          },
          createdAt,
        }
      }),
      skipDuplicates: true,
    })

    if (existing) {
      const hasNewerInbound = Boolean(
        newestInboundAt &&
          (!existing.lastInboundAt || newestInboundAt > existing.lastInboundAt)
      )
      const cycleUpdate = hasNewerInbound && newestInboundAt
        ? {
            slaStartedAt: newestInboundAt,
            firstResponseAt,
          }
        : {}
      await tx.inboxThread.update({
        where: { id: thread.id },
        data: {
          lastMessageAt: newestAt > existing.lastMessageAt ? newestAt : existing.lastMessageAt,
          lastInboundAt: hasNewerInbound ? newestInboundAt : existing.lastInboundAt,
          ...cycleUpdate,
        },
      })
    }

    return { threadCreated: !existing, messagesCreated: inserted.count }
  })
}

function safeDate(iso: string | undefined): Date {
  if (!iso) return new Date()
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}
