import { db } from '@/lib/db'
import type { ContentListQuery, ContentComment, ContentStatus } from './types'

const CONTENT_SELECT = {
  id: true,
  title: true,
  body: true,
  hashtags: true,
  status: true,
  authorName: true,
  thumbnailUrl: true,
  scheduledAt: true,
  publishedAt: true,
  updatedAt: true,
  platforms: { include: { platform: { select: { type: true } } } },
  campaign: { select: { name: true } },
} as const

export class ContentRepository {
  async listByWorkspace(workspaceId: string, query: ContentListQuery) {
    return db.content.findMany({
      where: {
        workspaceId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.campaignId ? { campaignId: query.campaignId } : {}),
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      select: CONTENT_SELECT,
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    })
  }

  async findInWorkspace(id: string, workspaceId: string) {
    return db.content.findFirst({ where: { id, workspaceId } })
  }

  async approveTransition(id: string, workspaceId: string, contentTitle: string) {
    return db.$transaction([
      db.content.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date(), rejectedReason: null },
      }),
      db.notification.create({
        data: {
          workspaceId,
          type: 'publish_success',
          title: 'محتوا تأیید شد ✓',
          body: `«${contentTitle}» تأیید شد و آماده انتشار است`,
        },
      }),
    ])
  }

  async rejectTransition(id: string, workspaceId: string, title: string, reason: string) {
    return db.$transaction([
      db.content.update({
        where: { id },
        data: { status: 'rejected', rejectedReason: reason },
      }),
      db.notification.create({
        data: {
          workspaceId,
          type: 'publish_failed',
          title: 'محتوا نیاز به بازبینی دارد',
          body: `«${title}» — ${reason}`,
        },
      }),
    ])
  }

  async submitReviewTransition(
    id: string,
    workspaceId: string,
    contentBody: string,
    contentTitle: string,
    approverCount: number
  ) {
    return db.$transaction([
      db.contentVersion.create({
        data: { contentId: id, body: contentBody, editedBy: 'submitter', editSummary: 'ارسال برای بررسی' },
      }),
      db.content.update({
        where: { id },
        data: { status: 'review', rejectedReason: null },
      }),
      db.notification.createMany({
        data: Array.from({ length: approverCount }, () => ({
          workspaceId,
          type: 'approval_requested' as const,
          title: 'محتوای جدید برای تأیید',
          body: contentTitle,
        })),
      }),
    ])
  }

  async findApproverIds(workspaceId: string): Promise<string[]> {
    const members = await db.workspaceMember.findMany({
      where: { workspaceId, role: { in: ['admin', 'approver'] } },
      select: { id: true },
    })
    return members.map((m) => m.id)
  }

  async listComments(contentId: string, parentId?: string): Promise<ContentComment[]> {
    const rows = await db.contentComment.findMany({
      where: parentId ? { contentId, parentId } : { contentId },
      orderBy: { createdAt: 'asc' },
    })
    return rows.map((r) => ({
      id: r.id,
      contentId: r.contentId,
      userId: r.userId,
      userName: r.userName,
      body: r.body,
      parentId: r.parentId,
      createdAt: r.createdAt,
    }))
  }

  async addComment(
    contentId: string,
    userId: string,
    userName: string,
    text: string,
    parentId?: string
  ): Promise<ContentComment> {
    const row = await db.contentComment.create({
      data: { contentId, userId, userName, body: text.trim(), parentId: parentId ?? null },
    })
    return {
      id: row.id,
      contentId: row.contentId,
      userId: row.userId,
      userName: row.userName,
      body: row.body,
      parentId: row.parentId,
      createdAt: row.createdAt,
    }
  }

}
