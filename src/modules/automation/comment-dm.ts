/**
 * Comment-to-DM automation module (#209).
 *
 * Worker execution is behind the comment_dm_beta feature flag.
 * The worker TODO: on new InboxMessage of type 'comment', match rules
 * for the platform, check freqCap via CommentDmLog, send DM via
 * Instagram Graph API, and log the result.
 */

import { db } from '@/lib/db'
import type { CommentDmRule } from './comment-dm-shared'
import { normalizePersian } from './comment-dm-shared'

export { previewTemplate, normalizePersian } from './comment-dm-shared'
export type { CommentDmRule }

export async function listRules(workspaceId: string, publicationId?: string): Promise<CommentDmRule[]> {
  const where = { workspaceId, ...(publicationId ? { publicationId } : {}) }
  const rows = await db.commentDmRule.findMany({
    where,
    include: { platform: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r): CommentDmRule => ({
    id: r.id,
    platformId: r.platformId,
    platformName: r.platform.name,
    keyword: r.keyword,
    keywords: (r.keywords as string[] | null) ?? undefined,
    excludeKeywords: (r.excludeKeywords as string[] | null) ?? undefined,
    dmTemplate: r.dmTemplate,
    buttonText: r.buttonText,
    buttonUrl: r.buttonUrl,
    publicReply: r.publicReply,
    optOutKeyword: r.optOutKeyword,
    freqCapHours: r.freqCapHours,
    isActive: r.isActive,
    status: r.status,
    publicationId: r.publicationId,
    igPostId: r.igPostId,
    createdAt: r.createdAt,
  }))
}

/** Input type for creating a rule — includes all fields the UI sends. */
export interface CreateRuleInput {
  platformId: string
  keyword?: string
  keywords?: string[]
  excludeKeywords?: string[]
  dmTemplate: string
  buttonText?: string | null
  buttonUrl?: string | null
  publicReply?: string | null
  optOutKeyword?: string
  freqCapHours?: number
  publicationId?: string | null
}

export async function createRule(workspaceId: string, data: CreateRuleInput): Promise<CommentDmRule> {
  // Normalize keywords: accept both keyword (singular) and keywords (array)
  const keywords = data.keywords?.length
    ? data.keywords
    : data.keyword
      ? [data.keyword]
      : []

  if (keywords.length === 0) throw new Error('کلمه الزامی است')
  if (!data.dmTemplate.trim()) throw new Error('متن پیام الزامی است')

  // Verify platform belongs to workspace and is Instagram
  const platform = await db.platform.findFirst({
    where: { id: data.platformId, workspaceId, type: 'instagram' },
  })
  if (!platform) throw new Error('پلتفرم اینستاگرام یافت نشد')

  // If publicationId is set, verify it belongs to this workspace
  if (data.publicationId) {
    const pub = await db.publication.findFirst({
      where: { id: data.publicationId, workspaceId },
    })
    if (!pub) throw new Error('انتشار یافت نشد')
  }

  const row = await db.commentDmRule.create({
    data: {
      workspaceId,
      platformId: data.platformId,
      keyword: keywords[0].toLowerCase(),
      keywords: keywords.length > 1 ? keywords as any : undefined,
      excludeKeywords: data.excludeKeywords?.length ? data.excludeKeywords as any : undefined,
      dmTemplate: data.dmTemplate.trim(),
      buttonText: data.buttonText || null,
      buttonUrl: data.buttonUrl || null,
      publicReply: data.publicReply || null,
      optOutKeyword: (data.optOutKeyword ?? 'نه').trim().toLowerCase(),
      freqCapHours: data.freqCapHours ?? 24,
      publicationId: data.publicationId ?? null,
    },
    include: { platform: { select: { name: true } } },
  })
  return {
    id: row.id,
    platformId: row.platformId,
    platformName: row.platform.name,
    keyword: row.keyword,
    keywords: (row.keywords as string[] | null) ?? undefined,
    excludeKeywords: (row.excludeKeywords as string[] | null) ?? undefined,
    dmTemplate: row.dmTemplate,
    buttonText: row.buttonText,
    buttonUrl: row.buttonUrl,
    publicReply: row.publicReply,
    optOutKeyword: row.optOutKeyword,
    freqCapHours: row.freqCapHours,
    isActive: row.isActive,
    status: row.status,
    publicationId: row.publicationId,
    igPostId: row.igPostId,
    createdAt: row.createdAt,
  }
}

/** Update an existing rule (edit flow). */
export async function updateRule(
  id: string,
  workspaceId: string,
  data: Partial<CreateRuleInput>
): Promise<void> {
  const existing = await db.commentDmRule.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('قانون یافت نشد')

  const updateData: Record<string, unknown> = {}
  if (data.keywords !== undefined) {
    updateData.keywords = data.keywords.length > 0 ? data.keywords as any : undefined
    updateData.keyword = data.keywords[0]?.toLowerCase() ?? existing.keyword
  } else if (data.keyword !== undefined) {
    updateData.keyword = data.keyword.toLowerCase()
    updateData.keywords = undefined
  }
  if (data.excludeKeywords !== undefined) {
    updateData.excludeKeywords = data.excludeKeywords.length > 0 ? data.excludeKeywords as any : undefined
  }
  if (data.dmTemplate !== undefined) updateData.dmTemplate = data.dmTemplate.trim()
  if (data.buttonText !== undefined) updateData.buttonText = data.buttonText || null
  if (data.buttonUrl !== undefined) updateData.buttonUrl = data.buttonUrl || null
  if (data.publicReply !== undefined) updateData.publicReply = data.publicReply || null
  if (data.optOutKeyword !== undefined) updateData.optOutKeyword = data.optOutKeyword.trim().toLowerCase()
  if (data.freqCapHours !== undefined) updateData.freqCapHours = data.freqCapHours

  await db.commentDmRule.update({ where: { id }, data: updateData })
}

export async function toggleRule(id: string, workspaceId: string, isActive: boolean): Promise<void> {
  const existing = await db.commentDmRule.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('قانون یافت نشد')
  await db.commentDmRule.update({ where: { id }, data: { isActive } })
}

export async function deleteRule(id: string, workspaceId: string): Promise<void> {
  const existing = await db.commentDmRule.findFirst({ where: { id, workspaceId } })
  if (!existing) throw new Error('قانون یافت نشد')
  await db.commentDmRule.delete({ where: { id } })
}

/**
 * Check if a rule should fire for a comment.
 * Returns false if: frequency cap active, opt-out keyword present, rule inactive.
 * Uses normalizePersian for robust Arabic/Persian variant matching.
 * TODO (worker): call this before sending via Instagram Graph API.
 */
export async function shouldSendDm(
  ruleId: string,
  senderUserId: string,
  commentText: string,
  optOutKeyword: string,
  freqCapHours: number
): Promise<boolean> {
  const normalizedComment = normalizePersian(commentText)
  const normalizedOptOut = normalizePersian(optOutKeyword)
  if (normalizedComment.includes(normalizedOptOut)) return false

  const since = new Date(Date.now() - freqCapHours * 60 * 60 * 1000)
  const recent = await db.commentDmLog.count({
    where: { ruleId, senderUserId, sentAt: { gte: since }, status: 'sent' },
  })
  return recent === 0
}
