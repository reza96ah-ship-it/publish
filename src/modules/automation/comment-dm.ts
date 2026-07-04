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

export { previewTemplate } from './comment-dm-shared'
export type { CommentDmRule }

export async function listRules(workspaceId: string): Promise<CommentDmRule[]> {
  const rows = await db.commentDmRule.findMany({
    where: { workspaceId },
    include: { platform: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    platformId: r.platformId,
    platformName: r.platform.name,
    keyword: r.keyword,
    keywords: r.keywords as string[] | undefined,
    excludeKeywords: r.excludeKeywords as string[] | undefined,
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

export async function createRule(
  workspaceId: string,
  data: { platformId: string; keyword: string; dmTemplate: string; optOutKeyword?: string; freqCapHours?: number }
): Promise<CommentDmRule> {
  if (!data.keyword.trim()) throw new Error('کلیدواژه الزامی است')
  if (!data.dmTemplate.trim()) throw new Error('متن پیام الزامی است')

  // Verify platform belongs to workspace and is Instagram
  const platform = await db.platform.findFirst({
    where: { id: data.platformId, workspaceId, type: 'instagram' },
  })
  if (!platform) throw new Error('پلتفرم اینستاگرام یافت نشد')

  const row = await db.commentDmRule.create({
    data: {
      workspaceId,
      platformId: data.platformId,
      keyword: data.keyword.trim().toLowerCase(),
      dmTemplate: data.dmTemplate.trim(),
      optOutKeyword: (data.optOutKeyword ?? 'نه').trim().toLowerCase(),
      freqCapHours: data.freqCapHours ?? 24,
    },
    include: { platform: { select: { name: true } } },
  })
  return {
    id: row.id,
    platformId: row.platformId,
    platformName: row.platform.name,
    keyword: row.keyword,
    keywords: row.keywords as string[] | undefined,
    excludeKeywords: row.excludeKeywords as string[] | undefined,
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
 * TODO (worker): call this before sending via Instagram Graph API.
 */
export async function shouldSendDm(
  ruleId: string,
  senderUserId: string,
  commentText: string,
  optOutKeyword: string,
  freqCapHours: number
): Promise<boolean> {
  const lowerComment = commentText.toLowerCase()
  if (lowerComment.includes(optOutKeyword.toLowerCase())) return false

  const since = new Date(Date.now() - freqCapHours * 60 * 60 * 1000)
  const recent = await db.commentDmLog.count({
    where: { ruleId, senderUserId, sentAt: { gte: since }, status: 'sent' },
  })
  return recent === 0
}
