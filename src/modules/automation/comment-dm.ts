/**
 * Comment-to-DM automation module (#209).
 * Rules are per-post (publicationId set) or workspace-wide (publicationId null).
 */

import { db } from '@/lib/db'
import type { CommentDmRule } from './comment-dm-shared'

export { previewTemplate, detectCommentKeyword } from './comment-dm-shared'
export type { CommentDmRule }

function toRule(r: {
  id: string
  platformId: string
  platform: { name: string }
  publicationId: string | null
  igPostId: string | null
  keyword: string
  dmTemplate: string
  publicReply: string | null
  optOutKeyword: string
  freqCapHours: number
  isActive: boolean
  createdAt: Date
}): CommentDmRule {
  return {
    id: r.id,
    platformId: r.platformId,
    platformName: r.platform.name,
    publicationId: r.publicationId,
    igPostId: r.igPostId,
    keyword: r.keyword,
    dmTemplate: r.dmTemplate,
    publicReply: r.publicReply,
    optOutKeyword: r.optOutKeyword,
    freqCapHours: r.freqCapHours,
    isActive: r.isActive,
    createdAt: r.createdAt,
  }
}

export async function listRules(workspaceId: string, publicationId?: string): Promise<CommentDmRule[]> {
  const rows = await db.commentDmRule.findMany({
    where: {
      workspaceId,
      ...(publicationId !== undefined ? { publicationId } : {}),
    },
    include: { platform: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toRule)
}

export async function createRule(
  workspaceId: string,
  data: {
    platformId: string
    keyword: string
    dmTemplate: string
    publicReply?: string | null
    optOutKeyword?: string
    freqCapHours?: number
    publicationId?: string | null
  }
): Promise<CommentDmRule> {
  if (!data.keyword.trim()) throw new Error('کلیدواژه الزامی است')
  if (!data.dmTemplate.trim()) throw new Error('متن پیام الزامی است')

  const platform = await db.platform.findFirst({
    where: { id: data.platformId, workspaceId, type: 'instagram' },
  })
  if (!platform) throw new Error('پلتفرم اینستاگرام یافت نشد')

  if (data.publicationId) {
    const pub = await db.publication.findFirst({ where: { id: data.publicationId, workspaceId } })
    if (!pub) throw new Error('انتشار یافت نشد')
  }

  const row = await db.commentDmRule.create({
    data: {
      workspaceId,
      platformId: data.platformId,
      publicationId: data.publicationId ?? null,
      keyword: data.keyword.trim().toLowerCase(),
      dmTemplate: data.dmTemplate.trim(),
      publicReply: data.publicReply?.trim() || null,
      optOutKeyword: (data.optOutKeyword ?? 'نه').trim().toLowerCase(),
      freqCapHours: data.freqCapHours ?? 24,
    },
    include: { platform: { select: { name: true } } },
  })
  return toRule(row)
}

export async function updateRuleIgPostId(id: string, workspaceId: string, igPostId: string): Promise<void> {
  await db.commentDmRule.updateMany({ where: { id, workspaceId }, data: { igPostId } })
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
