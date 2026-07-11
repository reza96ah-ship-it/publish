/**
 * Inbox Ingest Scanner — pulls real Instagram comments into the unified inbox.
 *
 * Before this scanner, InboxMessage rows only ever came from prisma/seed.ts —
 * the inbox looked functional but never showed a real customer comment. This
 * closes that gap by polling the IG Comments API on recently published media
 * and upserting each comment as an InboxMessage.
 *
 * Runs on a periodic timer inside the publish-worker (same lifecycle pattern
 * as comment-dm-scanner). For each active Instagram platform with a token:
 *   1. Lists recent successful publications (30-day lookback, newest first).
 *   2. Fetches up to 50 comments per media via the IG Comments API.
 *   3. Inserts unseen comments as InboxMessage rows. Dedup is enforced by the
 *      @@unique([platformId, externalId]) constraint — createMany with
 *      skipDuplicates makes re-scans idempotent.
 *
 * Self-comments (the account replying to its own commenters) are skipped so
 * the inbox only contains inbound customer messages.
 *
 * Permissions: the IG access token needs pages_read_engagement (same scope
 * the comment→DM scanner already requires). Missing scope → per-platform
 * fetch errors are logged and skipped; the scan continues.
 */

import { db } from './db'
import { decrypt } from './crypto'
import { emitInboxThread } from './emit'
import { listComments, type IgComment } from './instagram-messaging'

const SCAN_INTERVAL_MS = 2 * 60 * 1000 // 2 minutes — inbox freshness vs. IG rate limits
const PUBLICATION_LOOKBACK_DAYS = 30
const MAX_MEDIA_PER_PLATFORM = 10

export interface IngestDeps {
  listComments?: typeof listComments
}

export interface IngestStats {
  platformsScanned: number
  mediaScanned: number
  commentsSeen: number
  messagesCreated: number
}

let ingestTimer: ReturnType<typeof setInterval> | null = null
let ingestInProgress = false

export function startInboxIngestScanner(): void {
  if (ingestTimer) return
  // First scan after 30s (after boot + comment-dm scanner's first pass), then every 2min.
  setTimeout(() => {
    scanInbox().catch((err) =>
      console.error('[inbox-ingest] initial scan failed:', err)
    )
  }, 30_000)
  ingestTimer = setInterval(() => {
    scanInbox().catch((err) =>
      console.error('[inbox-ingest] scheduled scan failed:', err)
    )
  }, SCAN_INTERVAL_MS)
  console.log('[inbox-ingest] started — pulls IG comments into the inbox every 2min')
}

export function stopInboxIngestScanner(): void {
  if (ingestTimer) {
    clearInterval(ingestTimer)
    ingestTimer = null
    console.log('[inbox-ingest] stopped')
  }
}

/** Run one full ingest cycle. Exported for unit testing. */
export async function scanInbox(deps: IngestDeps = {}): Promise<IngestStats> {
  const stats: IngestStats = {
    platformsScanned: 0,
    mediaScanned: 0,
    commentsSeen: 0,
    messagesCreated: 0,
  }

  if (ingestInProgress) {
    console.warn('[inbox-ingest] previous scan still in progress — skipping cycle')
    return stats
  }
  ingestInProgress = true
  try {
    return await scanInboxInner(deps, stats)
  } finally {
    ingestInProgress = false
  }
}

async function scanInboxInner(deps: IngestDeps, stats: IngestStats): Promise<IngestStats> {
  const listCommentsFn = deps.listComments ?? listComments

  const platforms = await db.platform.findMany({
    where: {
      type: 'instagram',
      status: 'active',
      tokenSecret: { not: null },
      targetId: { not: null },
    },
    select: { id: true, workspaceId: true, tokenSecret: true, targetId: true, name: true },
  })

  for (const platform of platforms) {
    stats.platformsScanned++
    try {
      await scanPlatform(platform, listCommentsFn, stats)
    } catch (err) {
      console.error(
        `[inbox-ingest] platform ${platform.id} (${platform.name}) failed:`,
        (err as Error).message
      )
    }
  }

  if (stats.messagesCreated > 0) {
    console.log(
      `[inbox-ingest] cycle complete — platforms:${stats.platformsScanned} media:${stats.mediaScanned} comments:${stats.commentsSeen} new:${stats.messagesCreated}`
    )
  }
  return stats
}

interface PlatformRow {
  id: string
  workspaceId: string
  tokenSecret: string | null
  targetId: string | null
  name: string
}

async function scanPlatform(
  platform: PlatformRow,
  listCommentsFn: typeof listComments,
  stats: IngestStats
): Promise<void> {
  if (!platform.tokenSecret || !platform.targetId) return

  let accessToken: string
  try {
    accessToken = decrypt(platform.tokenSecret)
  } catch (err) {
    console.error(
      `[inbox-ingest] platform ${platform.id}: token decrypt failed:`,
      (err as Error).message
    )
    return
  }

  const since = new Date(Date.now() - PUBLICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const pubs = await db.publication.findMany({
    where: {
      platformId: platform.id,
      status: 'success',
      providerPostId: { not: null },
      completedAt: { gte: since },
    },
    select: { providerPostId: true },
    orderBy: { completedAt: 'desc' },
    take: MAX_MEDIA_PER_PLATFORM,
  })

  for (const pub of pubs) {
    if (!pub.providerPostId) continue
    stats.mediaScanned++

    let comments: IgComment[]
    try {
      comments = await listCommentsFn(accessToken, pub.providerPostId)
    } catch (err) {
      console.error(
        `[inbox-ingest] platform ${platform.id} media ${pub.providerPostId}: listComments failed:`,
        (err as Error).message
      )
      continue
    }

    // Skip the account's own comments (e.g. its public replies to customers).
    const inbound = comments.filter((c) => c.from?.id !== platform.targetId)
    stats.commentsSeen += inbound.length
    if (inbound.length === 0) continue

    // Legacy flat rows (old inbox list) — createMany + skipDuplicates keeps
    // re-scans idempotent via @@unique([platformId, externalId]).
    const result = await db.inboxMessage.createMany({
      data: inbound.map((c) => ({
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        senderName: c.from?.username ?? c.username ?? 'کاربر اینستاگرام',
        message: c.text ?? '',
        platformType: 'instagram',
        externalId: c.id,
        messageType: 'comment',
        // Preserve the provider-side timestamp so inbox ordering reflects
        // when the customer actually commented, not when we ingested it.
        createdAt: safeDate(c.timestamp),
      })),
      skipDuplicates: true, // @@unique([platformId, externalId]) → re-scans are no-ops
    })
    stats.messagesCreated += result.count

    // Thread rows — same shape the webhook ingest writes, so the poller acts
    // as a webhook backfill (missed deliveries, pre-webhook comments) instead
    // of a divergent second system. Convention matches
    // instagram-webhook-normalize: providerThreadId = `comment:{commentId}`.
    for (const c of inbound) {
      await ingestCommentThread(platform, c)
    }
  }
}

/** Upsert one comment into the thread model; emit realtime on new inbound. */
async function ingestCommentThread(platform: PlatformRow, c: IgComment): Promise<void> {
  const senderName = c.from?.username ?? c.username ?? 'کاربر اینستاگرام'
  const createdAt = safeDate(c.timestamp)

  try {
    const thread = await db.inboxThread.upsert({
      where: {
        platformId_providerThreadId: {
          platformId: platform.id,
          providerThreadId: `comment:${c.id}`,
        },
      },
      create: {
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        providerThreadId: `comment:${c.id}`,
        providerUserId: c.from?.id ?? null,
        title: senderName,
        messageType: 'comment',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
      },
      update: {},
      select: { id: true },
    })

    await db.inboxThreadMessage.create({
      data: {
        threadId: thread.id,
        workspaceId: platform.workspaceId,
        platformId: platform.id,
        providerMessageId: c.id,
        direction: 'inbound',
        messageType: 'comment',
        senderExternalId: c.from?.id ?? null,
        senderName,
        body: c.text ?? '',
        payload: { source: 'poll-backfill', commentId: c.id, timestamp: c.timestamp ?? null },
        createdAt,
      },
    })

    await db.inboxThread.update({
      where: { id: thread.id },
      data: {
        status: 'new',
        lastMessageAt: createdAt,
        lastInboundAt: createdAt,
        unreadCount: { increment: 1 },
      },
    })

    void emitInboxThread(platform.workspaceId, {
      threadId: thread.id,
      kind: 'message',
      messageType: 'comment',
      senderName,
      preview: (c.text ?? '').slice(0, 120),
    })
  } catch (err: unknown) {
    // P2002 on the message = webhook (or a previous scan) already ingested
    // this comment — the whole point of the backfill being idempotent.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return
    console.error(
      `[inbox-ingest] thread ingest failed for comment ${c.id}:`,
      (err as Error).message
    )
  }
}

/** Parse the IG ISO timestamp; fall back to now on malformed input. */
function safeDate(iso: string | undefined): Date {
  if (!iso) return new Date()
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? new Date() : d
}
