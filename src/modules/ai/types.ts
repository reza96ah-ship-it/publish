/**
 * Issue #200: AI domain module — types.
 *
 * Pure domain types shared between AI route handlers and the service.
 * No Prisma or Next.js imports.
 */

export interface CaptionStreamInput {
  topic: string
  platform: string
  tone?: string
  role?: string
  goal?: string
  length?: string
  variation?: number
  workspace?: import('@/lib/ai/gemini').WorkspaceContext
}

export interface CaptionMultiStreamInput {
  topic: string
  platforms: string[]
  tone?: string
  role?: string
  goal?: string
  length?: string
  workspace?: import('@/lib/ai/gemini').WorkspaceContext
}

export interface DraftListQuery {
  limit: number
}

export interface DraftItem {
  id: string
  title: string
  body: string
  hashtags: string
  platform: string | null
  tone: string | null
  role: string | null
  goal: string | null
  length: string | null
  authorName: string
  createdAt: Date
  updatedAt: Date
}

export interface SaveDraftInput {
  title?: string
  body: string
  hashtags?: string
  platform?: string
  tone?: string
  role?: string
  goal?: string
  length?: string
}

export interface SaveDraftResult {
  id: string
  title: string
  body: string
  hashtags: string | null
  platform: string | undefined
  tone: string | undefined
  role: string | undefined
  goal: string | undefined
  length: string | undefined
  authorName: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AuthContext {
  workspaceId: string
  userId: string
}
