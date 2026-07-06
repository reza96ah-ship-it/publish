/**
 * Issue #212: Content versioning + revision history — types.
 *
 * Pure domain types shared between route handler, service, and repository.
 * No imports from Prisma or Next.js here.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export interface RevisionRow {
  id: string
  contentId: string
  workspaceId: string
  title: string
  body: string | null
  hashtags: string | null
  internalNote: string | null
  authorName: string | null
  version: number
  createdAt: Date
}

export interface RevisionPayload {
  id: string
  contentId: string
  title: string
  body: string | null
  hashtags: string | null
  internalNote: string | null
  authorName: string | null
  version: number
  createdAt: string
}

export interface CreateRevisionInput {
  contentId: string
  workspaceId: string
  title: string
  body: string | null
  hashtags: string | null
  internalNote: string | null
  authorName: string | null
}

export interface FieldDiff {
  field: string
  from: string | null
  to: string | null
  changed: boolean
}

export interface RevisionDiff {
  revisionId: string
  previousRevisionId: string | null
  fields: FieldDiff[]
  /** Total number of changed fields — convenience for the UI badge. */
  changedCount: number
}

export interface RestoreResult {
  revision: RevisionPayload
  newRevision: RevisionPayload
}
