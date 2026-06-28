/**
 * Issue #124: Publications domain module — types.
 *
 * Shared types for the publications domain. These are the data contracts
 * between the route handler, service, and repository layers.
 *
 * No imports from Prisma or Next.js here — pure domain types.
 */

export type PublishMode = 'publish' | 'review' | 'draft'
export type ScheduleMode = 'now' | 'schedule' | 'queue'

export interface PublishRequest {
  title: string
  caption?: string
  hashtags?: string
  note?: string
  campaignId?: string
  mediaIds?: string[]
  channelIds?: string[]
  platformCaptions?: Record<string, string>
  scheduleMode: ScheduleMode
  scheduledAt?: string | null
  mode?: PublishMode
}

export interface PublishResult {
  contentId: string
  jobs: { id: string; platform: string; idempotencyKey: string }[]
  scheduledAt: string | null
  message: string
}

export interface AuthContext {
  workspaceId: string
  userId: string
  authorName: string
  role: string
}
