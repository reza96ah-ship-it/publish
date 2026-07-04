import { ContentRepository } from './repository'
import { ContentNotFoundError, InvalidStateTransitionError } from './errors'
import type {
  AuthContext,
  ContentListQuery,
  ContentListResult,
  ContentComment,
  AddCommentInput,
  TransitionResult,
} from './types'

export class ContentService {
  constructor(private readonly repo: ContentRepository = new ContentRepository()) {}

  async listContent(auth: AuthContext, query: ContentListQuery): Promise<ContentListResult> {
    const rows = await this.repo.listByWorkspace(auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null

    return {
      data: page.map((c) => ({
        id: c.id,
        title: c.title,
        body: c.body,
        hashtags: c.hashtags,
        status: c.status,
        authorName: c.authorName,
        thumbnail: c.thumbnailUrl,
        campaign: c.campaign?.name ?? 'بدون کمپین',
        platforms: c.platforms.map((p) => p.platform.type),
        scheduledAt: c.scheduledAt,
        publishedAt: c.publishedAt,
        updatedAt: c.updatedAt,
      })),
      nextCursor,
    }
  }

  async approveContent(auth: AuthContext, contentId: string): Promise<TransitionResult> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    if (content.status !== 'review') {
      throw new InvalidStateTransitionError(content.status, 'approved')
    }
    await this.repo.approveTransition(contentId, auth.workspaceId, content.title)
    return { ok: true, status: 'approved' }
  }

  async rejectContent(auth: AuthContext, contentId: string, reason: string): Promise<TransitionResult> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    if (content.status !== 'review') {
      throw new InvalidStateTransitionError(content.status, 'rejected')
    }
    await this.repo.rejectTransition(contentId, auth.workspaceId, content.title, reason)
    return { ok: true, status: 'rejected' }
  }

  async submitForReview(auth: AuthContext, contentId: string): Promise<TransitionResult> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    if (content.status !== 'draft' && content.status !== 'rejected') {
      throw new InvalidStateTransitionError(content.status, 'review')
    }
    const approverIds = await this.repo.findApproverIds(auth.workspaceId)
    await this.repo.submitReviewTransition(
      contentId,
      auth.workspaceId,
      content.body ?? '',
      content.title,
      approverIds.length
    )
    return { ok: true, status: 'review' }
  }

  async listComments(auth: AuthContext, contentId: string, parentId?: string): Promise<ContentComment[]> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    return this.repo.listComments(contentId, parentId)
  }

  async addComment(auth: AuthContext, contentId: string, input: AddCommentInput): Promise<ContentComment> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    return this.repo.addComment(contentId, auth.userId, 'کاربر', input.text, input.parentId)
  }

  async resolveComment(auth: AuthContext, contentId: string, commentId: string, resolved: boolean): Promise<void> {
    const content = await this.repo.findInWorkspace(contentId, auth.workspaceId)
    if (!content) throw new ContentNotFoundError()
    await this.repo.resolveComment(commentId, contentId, resolved)
  }
}

export const contentService = new ContentService()
