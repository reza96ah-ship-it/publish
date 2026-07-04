export type ContentStatus = 'draft' | 'review' | 'approved' | 'rejected' | 'published' | 'archived'

export interface AuthContext { workspaceId: string; userId: string }

export interface ContentListQuery {
  status?: string
  campaignId?: string
  cursor?: string
  limit: number
}

export interface ContentItem {
  id: string
  title: string
  body: string | null
  hashtags: string | null
  status: string
  authorName: string | null
  thumbnail: string | null
  campaign: string
  platforms: string[]
  scheduledAt: Date | null
  publishedAt: Date | null
  updatedAt: Date
}

export interface ContentListResult {
  data: ContentItem[]
  nextCursor: string | null
}

export interface ContentComment {
  id: string
  contentId: string
  userId: string
  userName: string
  body: string
  parentId: string | null
  createdAt: Date
  resolved: boolean
}

export interface AddCommentInput {
  text: string
  parentId?: string
}

export interface TransitionResult {
  ok: boolean
  status: ContentStatus
}
