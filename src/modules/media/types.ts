/**
 * Issue #156: Media domain module — types.
 *
 * Pure domain types shared between route handler, service, and repository.
 * No imports from Prisma or Next.js here.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export type MediaStatus =
  | 'pending'
  | 'uploaded'
  | 'validating'
  | 'validated'
  | 'rejected'
  | 'deleting'
  | 'deleted'

export type RejectedReason =
  | 'expired'
  | 'object_missing'
  | 'checksum_mismatch'
  | 'size_mismatch'
  | 'unsupported_format'
  | 'type_mismatch'
  | 'image_too_large'
  | 'decode_failed'

export interface PresignRequest {
  fileName: string
  fileType: string
  fileSize: number
}

export interface PresignResult {
  uploadUrl: string
  key: string
  mediaId: string
}

export interface ConfirmRequest {
  mediaId: string
}

export interface MediaPayload {
  id: string
  name: string
  fileType: string
  fileSize: number
  url: string
  thumbnail: string
  width: number | null
  height: number | null
  durationMs: number | null
  codec: string | null
}

export interface ConfirmResult {
  ok: true
  media: MediaPayload
}

export interface DeleteResult {
  ok: true
}

export interface ListQuery {
  cursor?: string
  limit: number
}

export interface ListResult {
  data: MediaPayload[]
  nextCursor: string | null
}

export interface MediaRow {
  id: string
  workspaceId: string
  uploaderId: string
  name: string
  fileType: string
  fileSize: number
  declaredType: string | null
  detectedType: string | null
  storageKey: string
  storageProvider: string
  status: string
  url: string
  thumbnailUrl: string | null
  folder: string
  tags: string
  expiresAt: Date | null
  checksumValue: string | null
  actualSize: number | null
  width: number | null
  height: number | null
  durationMs: number | null
  codec: string | null
  validatedAt: Date | null
  createdAt: Date
}
