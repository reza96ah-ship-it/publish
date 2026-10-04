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
 *      checks the opt-out keyword + frequency cap, sends the DM, then optionally
 *      posts a public reply only after the DM receipt is recorded.
 *   5. Records the outcome in CommentDmLog (pending | sent | partial | unknown | skipped).
 *
 * Design:
 *   - Idempotent: CommentDmLog @@unique([ruleId, commentId]) guarantees a
 *     comment is processed at most once per rule, even across scanner restarts
 *     or concurrent workers (P2002 → skip).
 *   - Resilient: ambiguous sends remain blocked from automatic retry and
 *     surface as status='unknown'. Per-media fetch errors are logged and skipped.
 *   - Rate-aware: scans at most every 60s, fetches ≤50 comments per media.
 *   - Self-contained: ships its own normalizePersian/matchComment (persian-match.ts)
 *     because the worker does not import from src/.
 *
 * Permissions: the IG access token must have instagram_business_manage_comments
 * and instagram_business_manage_messages scopes. Missing scopes surface as
 * API errors → CommentDmLog status='unknown' until the outcome is reconciled.
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
import { sendZernioPrivateCommentReply, sendZernioPublicCommentReply } from './zernio-comment-reply'

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
/** Guard: prevent overlapping scan cycles (if a scan takes >60s, skip the next). */
let scanInProgress = false

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
  // Overlap guard: if the previous scan is still running (e.g. a slow IG API
  // call took >60s), skip this cycle instead of running two concurrent scans
  // that could race on the same comments.
  if (scanInProgress) {
    console.warn('[comment-dm-scanner] previous scan still in progress — skipping cycle')
    return {
      rulesScanned: 0,
      mediaScanned: 0,
      commentsChecked: 0,
      dmsSent: 0,
      dmsSkipped: 0,
      dmsFailed: 0,
      publicReplies: 0,
    }
  }
  scanInProgress = true
  try {
    return await scanCommentDmsInner(now, deps)
  } finally {
    scanInProgress = false
  }
}

async function scanCommentDmsInner(
  now: Date,
  deps: IgApiDeps
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
  // P2-1: Honor the comment_dm_beta feature flag — only scan rules whose
  // workspace has the flag enabled. The API/UI gate on this flag; the worker
  // must too, otherwise disabling beta post-rollout wouldn't stop DMs.
  const rules = await db.commentDmRule.findMany({
    where: {
      isActive: true,
      status: 'active',
      platform: {
        type: 'instagram',
        provider: 'direct',
        status: 'active',
        tokenSecret: { not: null },
        targetId: { not: null },
      },
      // Only include rules from workspaces where comment_dm_beta is enabled.
      // Falls back to FEATURE_COMMENT_DM_BETA env var if no DB override exists.
      workspace: {
        featureFlags: {
          some: { flag: 'comment_dm_beta', enabled: true },
        },
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
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  // Env-level fallback: if FEATURE_COMMENT_DM_BETA is set false globally, skip
  // all rules regardless of DB overrides (matches src/lib/flags.ts priority).
  const envBeta = process.env.FEATURE_COMMENT_DM_BETA
  const envDisabled = envBeta !== undefined && envBeta !== '1' && envBeta.toLowerCase() !== 'true'
  // The same precedence is used for Zernio webhook rules: post-specific wins,
  // then the newest rule. Account-level claims enforce this across processes.
  const effectiveRules = envDisabled ? [] : [...rules].sort((a, b) =>
    Number(Boolean(b.publicationId || b.igPostId)) - Number(Boolean(a.publicationId || a.igPostId)))

  for (const rule of effectiveRules) {
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

  if (!envDisabled) await scanZernioCommentDmEvents(now, stats)

  if (stats.commentsChecked > 0) {
    console.log(
      `[comment-dm-scanner] cycle complete — rules:${stats.rulesScanned} media:${stats.mediaScanned} comments:${stats.commentsChecked} sent:${stats.dmsSent} skipped:${stats.dmsSkipped} failed:${stats.dmsFailed}`
    )
  }

  return stats
}

async function scanZernioCommentDmEvents(now: Date, stats: ScanStats): Promise<void> {
  const platforms = await db.platform.findMany({
    where: { type: 'instagram', provider: 'zernio', status: 'active', providerAccountId: { not: null } },
    select: { id: true, providerAccountId: true },
  })
  const accountIds = platforms.map((platform) => platform.providerAccountId).filter((id): id is string => Boolean(id))
  if (!accountIds.length) return
  const events = await db.providerWebhookEvent.findMany({
    where: {
      provider: 'zernio', providerObject: 'comment.received',
      providerAccountId: { in: accountIds }, status: 'processed', automationScannedAt: null,
    },
    orderBy: { receivedAt: 'asc' }, take: 100,
  })
  for (const event of events) {
    try {
      const payload = event.payload && typeof event.payload === 'object' && !Array.isArray(event.payload)
        ? event.payload as Record<string, unknown> : null
      const comment = payload?.comment && typeof payload.comment === 'object' && !Array.isArray(payload.comment)
        ? payload.comment as Record<string, unknown> : null
      const author = comment?.author && typeof comment.author === 'object' && !Array.isArray(comment.author)
        ? comment.author as Record<string, unknown> : null
      const accountId = event.providerAccountId
      const postId = comment?.platformPostId
      const commentId = comment?.id
      if (!comment || comment.platform !== 'instagram' || comment.isReply === true || author?.isOwnAccount !== false ||
          typeof accountId !== 'string' || typeof postId !== 'string' || typeof commentId !== 'string' ||
          typeof comment.text !== 'string' || typeof author.id !== 'string') {
        await db.providerWebhookEvent.update({ where: { id: event.id }, data: { automationScannedAt: now } })
        continue
      }
      const rules = await db.commentDmRule.findMany({
        where: {
          isActive: true, status: 'active', createdAt: { lte: event.receivedAt },
          platform: { provider: 'zernio', providerAccountId: accountId, status: 'active' },
          workspace: { featureFlags: { some: { flag: 'comment_dm_beta', enabled: true } } },
        },
        select: {
          id: true, workspaceId: true, platformId: true, publicationId: true, igPostId: true,
          keyword: true, keywords: true, excludeKeywords: true, dmTemplate: true,
          buttonText: true, buttonUrl: true, publicReply: true, optOutKeyword: true, freqCapHours: true,
          platform: { select: { tokenSecret: true, targetId: true, name: true } },
          publication: { select: { providerPostId: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50,
      })
      const applicable = rules.filter((rule) => {
        if (rule.igPostId && rule.igPostId !== postId) return false
        if (rule.publicationId && rule.publication?.providerPostId !== postId) return false
        const keywords = toStringArray(rule.keywords) ?? [rule.keyword]
        const excludes = toStringArray(rule.excludeKeywords) ?? []
        return matchComment(comment.text as string, keywords, excludes).matched
      }).sort((a, b) => Number(Boolean(b.publicationId || b.igPostId)) - Number(Boolean(a.publicationId || a.igPostId)))
      const selected = applicable[0]
      if (selected) {
        stats.rulesScanned++
        stats.commentsChecked++
        const igComment: IgComment = {
          id: commentId, text: comment.text, username: typeof author.username === 'string' ? author.username : '',
          from: { id: author.id, username: typeof author.username === 'string' ? author.username : undefined },
          timestamp: String(comment.createdAt),
        }
        const outcome = await processComment({
          rule: selected,
          comment: igComment,
          postId,
          keywords: toStringArray(selected.keywords) ?? [selected.keyword],
          excludeKeywords: toStringArray(selected.excludeKeywords) ?? [],
          accessToken: '', igUserId: accountId, now,
          deps: {
            listCommentsFn: listComments,
            sendDmFn: async (_token, id, commentIdToReply, text, buttonText, buttonUrl) => {
              // Instagram now rejects interactive private replies to non-followers,
              // consuming their one allowed reply. Always send plain text and
              // preserve a configured CTA as a normal link instead.
              const safeText = buttonUrl && !text.includes(buttonUrl)
                ? `${text}\n${buttonText ?? 'Link'}: ${buttonUrl}` : text
              return sendZernioPrivateCommentReply(id, postId, commentIdToReply, safeText)
            },
            replyCommentFn: (_token, parentId, text) =>
              sendZernioPublicCommentReply(accountId, postId, parentId, text, `${selected.id}:${commentId}`),
          },
        })
        if (outcome === 'sent' || outcome === 'partial') {
          stats.dmsSent++
          if (outcome === 'sent' && selected.publicReply) stats.publicReplies++
        }
        else if (outcome === 'skipped') stats.dmsSkipped++
        else stats.dmsFailed++
      }
      await db.providerWebhookEvent.update({ where: { id: event.id }, data: { automationScannedAt: now } })
    } catch (error) {
      console.error('[comment-dm-scanner] Zernio event failed:', error instanceof Error ? error.name : 'internal_error')
    }
  }
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
          postId: mediaId,
          keywords,
          excludeKeywords,
          accessToken,
          igUserId,
          now,
          deps,
        })
        if (outcome === 'sent' || outcome === 'partial') stats.dmsSent++
        else if (outcome === 'skipped') stats.dmsSkipped++
        else if (outcome === 'unknown') stats.dmsFailed++
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

type CommentOutcome = 'sent' | 'partial' | 'skipped' | 'unknown'

async function processComment(args: {
  rule: RuleRow
  comment: IgComment
  postId: string
  keywords: string[]
  excludeKeywords: string[]
  accessToken: string
  igUserId: string
  now: Date
  deps: { listCommentsFn: typeof listComments; sendDmFn: typeof sendDmForComment; replyCommentFn: typeof replyToComment }
}): Promise<CommentOutcome> {
  const { rule, comment, postId, keywords, excludeKeywords, accessToken, igUserId, now, deps } = args

  // Idempotency: skip if we already logged this (ruleId, commentId).
  const existing = await db.commentDmLog.findUnique({
    where: { ruleId_commentId: { ruleId: rule.id, commentId: comment.id } },
    select: { status: true },
  })
  if (existing) return 'skipped'

  // Match against keywords/excludes.
  const match = matchComment(comment.text ?? '', keywords, excludeKeywords)
  if (!match.matched) {
    await logCommentDm(rule, comment, postId, 'skipped')
    return 'skipped'
  }

  // Opt-out keyword check (normalizePersian both sides).
  const normalizedComment = normalizePersian(comment.text ?? '')
  const normalizedOptOut = normalizePersian(rule.optOutKeyword || 'نه')
  if (normalizedOptOut && normalizedComment.includes(normalizedOptOut)) {
    await logCommentDm(rule, comment, postId, 'skipped')
    return 'skipped'
  }

  // Meta private replies must be made within seven days of the comment. Never
  // call the provider when the timestamp is missing, stale, or implausibly future.
  const commentTime = Date.parse(comment.timestamp)
  if (!Number.isFinite(commentTime) || now.getTime() - commentTime >= 7 * 24 * 60 * 60 * 1000 ||
      commentTime > now.getTime() + 5 * 60 * 1000) {
    await logCommentDm(rule, comment, postId, 'skipped', 'comment_window_unavailable')
    return 'skipped'
  }

  // Legacy rows predate the account-level unique claim. Respect a prior
  // attempt by another rule before trying to reserve this comment again.
  const priorAttempt = await db.commentDmLog.findFirst({
    where: {
      workspaceId: rule.workspaceId, commentId: comment.id,
      status: { in: ['pending', 'sent', 'partial', 'unknown', 'failed'] },
    },
    select: { id: true },
  })
  if (priorAttempt) {
    await logCommentDm(rule, comment, postId, 'skipped', 'already_replied_to_comment')
    return 'skipped'
  }

  // An unresolved attempt may already have sent a DM, so it also consumes the
  // frequency cap until a human reconciles it.
  const senderUserId = comment.from?.id ?? comment.username
  const since = new Date(now.getTime() - rule.freqCapHours * 60 * 60 * 1000)
  const recentSent = await db.commentDmLog.count({
    where: {
      ruleId: rule.id,
      senderUserId,
      status: { in: ['pending', 'sent', 'partial', 'unknown', 'failed'] },
      sentAt: { gte: since },
    },
  })
  if (recentSent > 0) {
    await logCommentDm(rule, comment, postId, 'skipped', 'frequency_cap')
    return 'skipped'
  }

  // Claim before the external API call. The nullable account-level keys are
  // unique across rules, so concurrent workers cannot send for the same comment
  // or to the same commenter on one post even when different rules match.
  //
  // If the worker crashes between claim and acknowledgement, the row stays
  // pending (blocks reprocessing without falsely claiming a send succeeded).
  try {
    await db.commentDmLog.create({
      data: {
        workspaceId: rule.workspaceId,
        ruleId: rule.id,
        commentId: comment.id,
        postId,
        claimPlatformId: rule.platformId,
        senderUserId: senderUserId ?? comment.from?.id ?? comment.username ?? 'unknown',
        status: 'pending',
      },
    })
  } catch (err: unknown) {
    // P2002 = another rule/worker already claimed this comment or commenter/post.
    if (err && typeof err === 'object' && 'code' in err && err.code === 'P2002') {
      await logCommentDm(rule, comment, postId, 'skipped', 'already_claimed')
      return 'skipped'
    }
    throw err
  }

  // A rule can be disabled or deleted while a scan is in progress. Recheck
  // after the claim and immediately before the provider call. Retain the claim
  // even if skipped so a concurrent scan cannot race into a private reply.
  const currentRule = await db.commentDmRule.findFirst({
    where: { id: rule.id, workspaceId: rule.workspaceId },
    select: { isActive: true, status: true },
  })
  if (!currentRule?.isActive || currentRule.status !== 'active') {
    await updateLogStatus(rule.id, comment.id, { status: 'skipped', errorCode: 'rule_disabled_before_send' })
    return 'skipped'
  }

  // Confirm the DM before posting a public "sent you a DM" reply. A timeout
  // or missing receipt is ambiguous and must never trigger an automatic retry.
  const senderName = comment.from?.username ?? comment.username ?? ''
  const dmText = renderDmTemplate(rule.dmTemplate, senderName)
  let providerMessageId: string | null
  try {
    const receipt = await deps.sendDmFn(accessToken, igUserId, comment.id, dmText, rule.buttonText, rule.buttonUrl)
    providerMessageId = typeof receipt.messageId === 'string' && receipt.messageId.trim()
      ? receipt.messageId : null
  } catch (err) {
    console.error(
      `[comment-dm-scanner] rule ${rule.id} comment ${comment.id}: DM outcome unknown:`,
      err instanceof Error ? err.name : 'internal_error'
    )
    await updateLogStatus(rule.id, comment.id, { status: 'unknown', errorCode: 'dm_outcome_unknown' })
    return 'unknown'
  }
  if (!providerMessageId) {
    await updateLogStatus(rule.id, comment.id, { status: 'unknown', errorCode: 'missing_dm_receipt' })
    return 'unknown'
  }
  await updateLogStatus(rule.id, comment.id, {
    status: 'sent', providerMessageId, sentAt: now,
    ...(rule.publicReply ? { publicReplyStatus: 'pending' } : {}),
  })

  if (!rule.publicReply) return 'sent'
  try {
    const publicReceipt = await deps.replyCommentFn(accessToken, comment.id, rule.publicReply)
    if (typeof publicReceipt.id !== 'string' || !publicReceipt.id.trim()) {
      throw new Error('missing_public_reply_receipt')
    }
    await updateLogStatus(rule.id, comment.id, { publicReplyStatus: 'sent' })
    return 'sent'
  } catch (err) {
    console.error(
      `[comment-dm-scanner] rule ${rule.id} comment ${comment.id}: public reply outcome unconfirmed:`,
      err instanceof Error ? err.name : 'internal_error'
    )
    await updateLogStatus(rule.id, comment.id, {
      status: 'partial', publicReplyStatus: 'unknown', errorCode: 'public_reply_unconfirmed',
    })
    return 'partial'
  }
}

/** Persist provider evidence before reporting an attempt as successful. */
async function updateLogStatus(
  ruleId: string,
  commentId: string,
  data: {
    status?: 'sent' | 'partial' | 'unknown' | 'skipped'
    providerMessageId?: string
    publicReplyStatus?: 'pending' | 'sent' | 'unknown'
    errorCode?: string
    sentAt?: Date
  },
): Promise<void> {
  await db.commentDmLog.update({
    where: { ruleId_commentId: { ruleId, commentId } },
    data,
  })
}

/** Insert a CommentDmLog row. P2002 (unique violation) = race, ignore. */
async function logCommentDm(
  rule: RuleRow,
  comment: IgComment,
  postId: string,
  status: 'skipped',
  errorCode?: string,
): Promise<void> {
  try {
    await db.commentDmLog.create({
      data: {
        workspaceId: rule.workspaceId,
        ruleId: rule.id,
        commentId: comment.id,
        postId,
        senderUserId: comment.from?.id ?? comment.username ?? 'unknown',
        status,
        errorCode,
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
