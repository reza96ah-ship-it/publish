/**
 * Issue #156: Media domain module — repository layer.
 *
 * Data access only — no business logic. Wraps Prisma calls so the service
 * layer can be unit-tested with a mock repository (no DB needed).
 *
 * Storage operations (S3/local-disk) are NOT done here — they are
 * infrastructure, handled by the service via src/lib/storage. This keeps the
 * repository's contract narrow: Prisma only.
 */

import { db } from '@/lib/db'
import type { MediaRow } from './types'

// Re-export the Media type alias for ergonomics — Prisma's generated type.
type Media = Awaited<ReturnType<typeof db.media.findFirst>>

function toMediaRow(m: NonNullable<Media>): MediaRow {
  return {
    id: m.id,
    workspaceId: m.workspaceId,
    uploaderId: m.uploaderId ?? '',
    name: m.name ?? '',
    fileType: m.fileType ?? '',
    fileSize: Number(m.fileSize ?? 0),
    declaredType: m.declaredType ?? '',
    detectedType: m.detectedType ?? '',
    storageKey: m.storageKey ?? '',
    storageProvider: m.storageProvider ?? '',
    status: m.status ?? 'pending',
    url: m.url ?? '',
    thumbnailUrl: m.thumbnailUrl ?? null,
    folder: m.folder ?? '',
    tags: m.tags ?? [],
    expiresAt: m.expiresAt,
    checksumValue: m.checksumValue,
    actualSize: m.actualSize,
    width: m.width,
    height: m.height,
    durationMs: m.durationMs,
    codec: m.codec,
    validatedAt: m.validatedAt,
    createdAt: m.createdAt,
  }
}

export class MediaRepository {
  /** Count pending/in-flight uploads (bounds abandoned-upload growth). */
  async countPending(workspaceId: string): Promise<number> {
    return db.media.count({
      where: { workspaceId, status: { in: ['pending', 'uploaded', 'validating'] } },
    })
  }

  /** Sum file sizes of validated assets in the workspace (used quota). */
  async sumValidatedBytes(workspaceId: string): Promise<number> {
    const agg = await db.media.aggregate({
      where: { workspaceId, status: 'validated' },
      _sum: { fileSize: true },
    })
    return agg._sum.fileSize ?? 0
  }

  /** Create a pending Media row (presign). */
  async createPending(input: {
    workspaceId: string
    uploaderId: string
    name: string
    fileType: string
    fileSize: number
    declaredType: string
    storageKey: string
    storageProvider: string
    expiresAt: Date
  }): Promise<MediaRow> {
    const m = await db.media.create({
      data: {
        workspaceId: input.workspaceId,
        uploaderId: input.uploaderId,
        name: input.name,
        fileType: input.fileType,
        fileSize: input.fileSize,
        declaredType: input.declaredType,
        storageKey: input.storageKey,
        storageProvider: input.storageProvider,
        status: 'pending',
        url: '',
        folder: 'default',
        tags: '',
        expiresAt: input.expiresAt,
      },
    })
    return toMediaRow(m)
  }

  /** Find one Media row scoped to a workspace (object-level tenant auth). */
  async findByIdInWorkspace(
    mediaId: string,
    workspaceId: string
  ): Promise<MediaRow | null> {
    const m = await db.media.findFirst({ where: { id: mediaId, workspaceId } })
    return m ? toMediaRow(m) : null
  }

  /** Patch a Media row's status only. */
  async updateStatus(
    mediaId: string,
    status: string,
    extra?: Record<string, unknown>
  ): Promise<MediaRow> {
    const m = await db.media.update({
      where: { id: mediaId },
      data: { status, ...extra },
    })
    return toMediaRow(m)
  }

  /** Mark as rejected with a safe reason. */
  async markRejected(mediaId: string, reason: string): Promise<MediaRow> {
    return this.updateStatus(mediaId, 'rejected', { rejectedReason: reason })
  }

  /** Finalize after successful validation — write metadata + URL + thumbnail. */
  async finalizeValidated(
    mediaId: string,
    fields: {
      detectedType: string | null
      width: number | null
      height: number | null
      url: string
      thumbnailUrl: string
      durationMs: number | null
      codec: string | null
    }
  ): Promise<MediaRow> {
    const m = await db.media.update({
      where: { id: mediaId },
      data: {
        status: 'validated',
        detectedType: fields.detectedType,
        width: fields.width,
        height: fields.height,
        url: fields.url,
        thumbnailUrl: fields.thumbnailUrl,
        durationMs: fields.durationMs,
        codec: fields.codec,
        validatedAt: new Date(),
      },
    })
    return toMediaRow(m)
  }

  /** Find revisions referencing this media (used by delete guard). */
  async findRevisionsReferencingMedia(
    mediaId: string
  ): Promise<{ revisionId: string }[]> {
    const rows = await (db as unknown as {
      revisionMedia: { findMany: (args: unknown) => Promise<{ revisionId: string }[]> }
    }).revisionMedia.findMany({
      where: { mediaId },
      select: { revisionId: true },
    })
    return rows
  }

  /** Check if any active (non-terminal) publication still depends on a revision. */
  async findActivePublicationForRevisions(
    revisionIds: string[]
  ): Promise<{ id: string } | null> {
    if (revisionIds.length === 0) return null
    const pub = await (db as unknown as {
      publication: {
        findFirst: (args: unknown) => Promise<{ id: string } | null>
      }
    }).publication.findFirst({
      where: {
        revisionId: { in: revisionIds },
        status: { in: ['pending', 'processing', 'action', 'scheduled'] },
      },
      select: { id: true },
    })
    return pub
  }

  /** Cursor-paginated list of validated media for the workspace library. */
  async listValidated(
    workspaceId: string,
    query: { cursor?: string; limit: number }
  ): Promise<MediaRow[]> {
    const rows = await db.media.findMany({
      where: {
        workspaceId,
        status: 'validated',
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    })
    return rows.map(toMediaRow)
  }
}
