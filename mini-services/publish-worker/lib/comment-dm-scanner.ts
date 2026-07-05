/**
 * Comment→DM Scanner — the worker piece that makes CommentDmRule actually fire.
 *
 * Runs on a periodic timer inside the publish-worker. For each active rule:
 *   1. Resolves which Instagram media(s) to scan (one publication or all
 *      successful publications on the platform).
 *   2. Fetches recent comments via the IG Comments API.
 *   3. For each comment, checks the CommentDmLog idempotency table — if a row
 *      already exists for (ruleId, commentId), the comment was already
 *      processed and is skipped.
 *   4. Otherwise: matches the comment against the rule's keywords/excludes,
 *      checks the opt-out keyword + frequency cap, optionally posts a public
 *      reply, then sends the DM via the IG Messaging API.
 *   5. Records the outcome in CommentDmLog (sent | skipped | failed).
 *
 * Design:
 *   - Idempotent: CommentDmLog @@unique([ruleId, commentId]) guarantees a
 *     comment is processed at most once per rule, even across scanner restarts
 *     or concurrent workers (P2002 → skip).
 *   - Resilient: per-comment errors are logged as status='failed' and do not
 *     abort the scan. Per-media fetch errors are logged and skipped.
 *   - Rate-aware: scans at most every 60s, fetches ≤50 comments per media.
 *   - Self-contained: ships its own normalizePersian/matchComment (persian-match.ts)
 *     because the worker does not import from src/.
 *
 * Permissions: the IG access token must have pages_read_engagement,
 * instagram_manage_comments, and instagram_manage_messages scopes. Missing
 * scopes surface as API 403s → CommentDmLog status='failed'.
 */

import { db } from './db'
import { decrypt } from './crypto'
import { normalizePersian, matchComment, renderDmTemplate } from './persian-match'
import {
  listComments,
  sendDmForComment,
  replyToComment,
  type IgComment,
} from './instagram-messaging'

const SCAN_INTERVAL_MS = 60 * 1000 // 60 seconds — fast enough for good UX, gentle on IG rate limits
/** Only scan publications from the last N days (avoids re-scanning very old posts). */
const PUBLICATION_LOOKBACK_DAYS = 30
/** Max publications to scan per workspace-wide rule per cycle. */
const MAX_MEDIA_PER_RULE = 10

export interface IgApiDeps {
  listComments?: typeof listComments
  sendDm?: typeof sendDmForComment
  replyComment?: typeof replyToComment
}

export interface ScanStats {
  rulesScanned: number
  mediaScanned: number
  commentsChecked: number
  dmsSent: number
  dmsSkipped: number
  dmsFailed: number
  publicReplies: number
}

let scanTimer: ReturnType<typeof setInterval> | null = null

export function startCommentDmScanner(): void {
  if (scanTimer) return
  // First scan after 15s (let other systems boot), then every 60s.
  setTimeout(() => {
    scanCommentDms().catch((err) =>
      console.error('[comment-dm-scanner] initial scan failed:', err)
    )
  }, 15_000)
  scanTimer = setInterval(() => {
    scanCommentDms().catch((err) =>
      console.error('[comment-dm-scanner] scheduled scan failed:', err)
    )
  }, SCAN_INTERVAL_MS)
  console.log('[comment-dm-scanner] started — scans every 60s for new IG comments')
}

export function stopCommentDmScanner(): void {
  if (scanTimer) {
    clearInterval(scanTimer)
    scanTimer = null
    console.log('[comment-dm-scanner] stopped')
  }
}

/**
 * Run one full scan cycle. Exported for unit testing.
 *
 * @param now    Injection point for the current time (tests).
 * @param deps   Injectable IG API functions (tests can mock without fetch).
 */
export async function scanCommentDms(
  now: Date = new Date(),
  deps: IgApiDeps = {}
): Promise<ScanStats> {
  const listCommentsFn = deps.listComments ?? listComments
  const sendDmFn = deps.sendDm ?? sendDmForComment
  const replyCommentFn = deps.replyComment ?? replyToComment

  const stats: ScanStats = {
    rulesScanned: 0,
    mediaScanned: 0,
    commentsChecked: 0,
    dmsSent: 0,
    dmsSkipped: 0,
    dmsFailed: 0,
    publicReplies: 0,
  }

  // Active rules on active Instagram platforms with a token + ig-user-id set.
  const rules = await db.commentDmRule.findMany({
    where: {
      isActive: true,
      status: 'active',
      platform: {
        type: 'instagram',
        status: 'active',
        tokenSecret: { not: null },
        targetId: { not: null },
      },
    },
    select: {
      id: true,
      workspaceId: true,
      platformId: true,
      publicationId: true,
      igPostId: true,
      keyword: true,
      keywords: true,
      excludeKeywords: true,
      dmTemplate: true,
      buttonText: true,
      buttonUrl: true,
      publicReply: true,
      optOutKeyword: true,
      freqCapHours: true,
      platform: { select: { tokenSecret: true, targetId: true, name: true } },
    },
  })

  for (const rule of rules) {
    stats.rulesScanned++
    try {
      await scanRule(rule, now, { listCommentsFn, sendDmFn, replyCommentFn }, stats)
    } catch (err) {
      console.error(
        `[comment-dm-scanner] rule ${rule.id} failed:`,
        (err as Error).message
      )
    }
  }

  if (stats.commentsChecked > 0) {
    console.log(
      `[comment-dm-scanner] cycle complete — rules:${stats.rulesScanned} media:${stats.mediaScanned} comments:${stats.commentsChecked} sent:${stats.dmsSent} skipped:${stats.dmsSkipped} failed:${stats.dmsFailed}`
    )
  }

  return stats
}

interface RuleRow {
  id: string
  workspaceId: string
  platformId: string
  publicationId: string | null
  igPostId: string | null
  keyword: string
  keywords: unknown
  excludeKeywords: unknown
  dmTemplate: string
  buttonText: string | null
  buttonUrl: string | null
  publicReply: string | null
  optOutKeyword: string
  freqCapHours: number
  platform: { tokenSecret: string | null; targetId: string | null; name: string }
}

async function scanRule(
  rule: RuleRow,
  now: Date,
  deps: { listCommentsFn: typeof listComments; sendDmFn: typeof sendDmForComment; replyCommentFn: typeof replyToComment },
  stats: ScanStats
): Promise<void> {
  if (!rule.platform.tokenSecret || !rule.platform.targetId) return

  let accessToken: string
  try {
    accessToken = decrypt(rule.platform.tokenSecret)
  } catch (err) {
    console.error(
      `[comment-dm-scanner] rule ${rule.id}: token decrypt failed:`,
      (err as Error).message
    )
    return
  }
  const igUserId = rule.platform.targetId

  const keywords = toStringArray(rule.keywords) ?? [rule.keyword]
  const excludeKeywords = toStringArray(rule.excludeKeywords) ?? []
  if (keywords.length === 0) return

  // Resolve media IDs to scan.
  const mediaIds = await resolveMediaIds(rule)
  if (mediaIds.length === 0) return

  for (const mediaId of mediaIds) {
    stats.mediaScanned++
    let comments: IgComment[]
    try {
      comments = await deps.listCommentsFn(accessToken, mediaId)
    } catch (err) {
      console.error(
        `[comment-dm-scanner] rule ${rule.id} media ${mediaId}: listComments failed:`,
        (err as Error).message
      )
      continue
    }

    for (const comment of comments) {
      stats.commentsChecked++
      try {
        const outcome = await processComment({
          rule,
          comment,
          keywords,
          excludeKeywords,
          accessToken,
          igUserId,
          now,
          deps,
        })
        if (outcome === 'sent') stats.dmsSent++
        else if (outcome === 'skipped') stats.dmsSkipped++
        else if (outcome === 'failed') stats.dmsFailed++
        if (outcome === 'sent' && rule.publicReply) stats.publicReplies++
      } catch (err) {
        // Defensive: processComment catches its own errors, but log just in case.
        console.error(
          `[comment-dm-scanner] rule ${rule.id} comment ${comment.id}: unexpected error:`,
          (err as Error).message
        )
        stats.dmsFailed++
      }
    }
  }
}

type CommentOutcome = 'sent' | 'skipped' | 'failed'

async function processComment(args: {
  rule: RuleRow
  comment: IgComment
  keywords: string[]
  excludeKeywords: string[]
  accessToken: string
  igUserId: string
  now: Date
  deps: { listCommentsFn: typeof listComments; sendDmFn: typeof sendDmForComment; replyCommentFn: typeof replyToComment }
}): Promise<CommentOutcome> {
  const { rule, comment, keywords, excludeKeywords, accessToken, igUserId, now, deps } = args

  // Idempotency: skip if we already logged this (ruleId, commentId).
  const existing = await db.commentDmLog.findUnique({
    where: { ruleId_commentId: { ruleId: rule.id, commentId: comment.id } },
    select: { status: true },
  })
  if (existing) return 'skipped'

  // Match against keywords/excludes.
  const match = matchComment(comment.text ?? '', keywords, excludeKeywords)
  if (!match.matched) {
    await logCommentDm(rule, comment, 'skipped')
    return 'skipped'
  }

  // Opt-out keyword check (normalizePersian both sides).
  const normalizedComment = normalizePersian(comment.text ?? '')
  const normalizedOptOut = normalizePersian(rule.optOutKeyword || 'نه')
  if (normalizedOptOut && normalizedComment.includes(normalizedOptOut)) {
    await logCommentDm(rule, comment, 'skipped')
    return 'skipped'
  }

  // Frequency cap: any 'sent' log to the same sender within freqCapHours?
  const senderUserId = comment.from?.id ?? comment.username
  const since = new Date(now.getTime() - rule.freqCapHours * 60 * 60 * 1000)
  const recentSent = await db.commentDmLog.count({
    where: {
      ruleId: rule.id,
      senderUserId,
      status: 'sent',
      sentAt: { gte: since },
    },
  })
  if (recentSent > 0) {
    await logCommentDm(rule, comment, 'skipped')
    return 'skipped'
  }

  // Send public reply first (if configured) — best-effort, doesn't block DM.
  if (rule.publicReply) {
    try {
      await deps.replyCommentFn(accessToken, comment.id, rule.publicReply)
    } catch (err) {
      console.error(
        `[comment-dm-scanner] rule ${rule.id} comment ${comment.id}: public reply failed (continuing to DM):`,
        (err as Error).message
      )
    }
  }

  // Send the DM.
  const senderName = comment.from?.username ?? comment.username ?? ''
  const dmText = renderDmTemplate(rule.dmTemplate, senderName)
  try {
    await deps.sendDmFn(accessToken, igUserId, comment.id, dmText)
    await logCommentDm(rule, comment, 'sent', senderUserId)
    return 'sent'
  } catch (err) {
    console.error(
      `[comment-dm-scanner] rule ${rule.id} comment ${comment.id}: DM send failed:`,
      (err as Error).message
    )
    await logCommentDm(rule, comment, 'failed', senderUserId)
    return 'failed'
  }
}

/** Insert a CommentDmLog row. P2002 (unique violation) = race, ignore. */
async function logCommentDm(
  rule: RuleRow,
  comment: IgComment,
  status: 'sent' | 'skipped' | 'failed',
  senderUserId?: string
): Promise<void> {
  try {
    await db.commentDmLog.create({
      data: {
        workspaceId: rule.workspaceId,
        ruleId: rule.id,
        commentId: comment.id,
        senderUserId: senderUserId ?? comment.from?.id ?? comment.username ?? 'unknown',
        status,
      },
    })
  } catch (err: unknown) {
    // P2002 = unique constraint violation — another worker logged it first. Safe to ignore.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') return
    throw err
  }
}

/**
 * Resolve which IG media IDs to scan for a rule.
 *   - rule.igPostId set (post-scoped after publish) → [igPostId]
 *   - rule.publicationId set → that publication's providerPostId
 *   - else (workspace-wide) → recent successful publications on this platform
 */
async function resolveMediaIds(rule: RuleRow): Promise<string[]> {
  if (rule.igPostId) return [rule.igPostId]

  if (rule.publicationId) {
    const pub = await db.publication.findUnique({
      where: { id: rule.publicationId },
      select: { providerPostId: true, status: true },
    })
    if (pub?.status === 'success' && pub.providerPostId) return [pub.providerPostId]
    return []
  }

  // Workspace-wide: scan recent successful publications on this platform.
  const since = new Date(Date.now() - PUBLICATION_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
  const pubs = await db.publication.findMany({
    where: {
      platformId: rule.platformId,
      status: 'success',
      providerPostId: { not: null },
      completedAt: { gte: since },
    },
    select: { providerPostId: true },
    orderBy: { completedAt: 'desc' },
    take: MAX_MEDIA_PER_RULE,
  })
  return pubs
    .map((p) => p.providerPostId)
    .filter((id): id is string => id !== null && id !== undefined)
}

/** Safely cast a Prisma Json field to string[]. */
function toStringArray(value: unknown): string[] | null {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string')
  }
  return null
}
