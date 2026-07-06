/**
 * Issue #255: Public API v1 — read-only DTO shapes.
 *
 * These shapes are intentionally narrower than the admin ContentItem /
 * InboxMessage / Publication types: the public API is a stable contract
 * with external integrators (Zapier, n8n, custom dashboards), so we only
 * expose fields that are safe to publish and meaningful outside the app.
 *
 * No imports from Prisma or Next.js here — pure domain types only.
 */

export interface PublicContentItem {
  id: string
  title: string
  body: string | null
  hashtags: string | null
  status: string
  authorName: string | null
  thumbnailUrl: string | null
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string
}

export interface PublicPublicationItem {
  id: string
  contentId: string
  contentTitle: string
  platformId: string
  status: string
  scheduledAt: string | null
  providerPostId: string | null
  completedAt: string | null
  errorCategory: string | null
  errorMessage: string | null
  createdAt: string
}

export interface PublicInboxItem {
  id: string
  senderName: string | null
  message: string | null
  isRead: boolean
  isReplied: boolean
  reply: string | null
  platform: string
  platformName: string
  messageType: string | null
  status: string
  createdAt: string
}

export interface PublicReportDay {
  /** ISO date (YYYY-MM-DD) for each day in the range. */
  date: string
  /** Metric → value for that day. Missing metrics default to 0. */
  metrics: {
    reach: number
    impressions: number
    engagement: number
    followers: number
    clicks: number
    conversions: number
  }
}

export interface PublicReportResult {
  days: number
  totals: {
    reach: number
    impressions: number
    engagement: number
    followers: number
    clicks: number
    conversions: number
  }
  daily: PublicReportDay[]
}

export interface CursorListResult<T> {
  data: T[]
  nextCursor: string | null
}

export interface CursorListQuery {
  cursor?: string
  limit?: number
}
