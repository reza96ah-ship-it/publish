/**
 * Comment-to-DM automation module (#209).
 * Rules are per-post (publicationId set) or workspace-wide (publicationId null).
 */

import { db } from '@/lib/db'
import { parseKeywordList } from './comment-dm-shared'
import type { CommentDmRule } from './comment-dm-shared'

export { previewTemplate, detectCommentKeyword, normalizePersian, matchComment, parseKeywordList } from './comment-dm-shared'
export type { CommentDmRule }

/** Coerce a Prisma Json column into a string[]. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string')
  return []
}

function toRule(r: {
  id: string
  platformId: string
  platform: { name: string }
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
  status: string
  isActive: boolean
  createdAt: Date
}): CommentDmRule {
  const keywords = toStringArray(r.keywords)
  return {
    id: r.id,
    platformId: r.platformId,
    platformName: r.platform.name,
    publicationId: r.publicationId,
    igPostId: r.igPostId,
    keyword: r.keyword,
    keywords: keywords.length ? keywords : (r.keyword ? [r.keyword] : []),
    excludeKeywords: toStringArray(r.excludeKeywords),
    dmTemplate: r.dmTemplate,
    buttonText: r.buttonText,
    buttonUrl: r.buttonUrl,
    publicReply: r.publicReply,
    optOutKeyword: r.optOutKeyword,
    status: r.status,
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
): Promise<CommentDmRule> {
  // Accept either a keywords[] array or a single/comma-separated `keyword` field.
  const keywords = (data.keywords?.length ? data.keywords : parseKeywordList(data.keyword ?? ''))
    .map((k) => k.trim())
    .filter(Boolean)
  const excludeKeywords = (data.excludeKeywords ?? []).map((k) => k.trim()).filter(Boolean)

  if (keywords.length === 0) throw new Error('حداقل یک کلیدواژه الزامی است')
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
      keyword: keywords[0],
      keywords,
      excludeKeywords,
      dmTemplate: data.dmTemplate.trim(),
      buttonText: data.buttonText?.trim() || null,
      buttonUrl: data.buttonUrl?.trim() || null,
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
  await db.commentDmRule.update({
    where: { id },
    data: { isActive, status: isActive ? 'active' : 'paused' },
  })
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
