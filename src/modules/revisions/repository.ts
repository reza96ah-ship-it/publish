/**
 * Issue #212: Content versioning + revision history — repository.
 *
 * Data-access layer. db is imported ONLY here (architecture rule).
 * Exposes pure-data methods; the service adds validation + Persian error
 * mapping. Each revision is an immutable snapshot — never updated in place.
 */

import { db } from '@/lib/db'
import type { RevisionRow, CreateRevisionInput } from './types'

function toRevisionRow(r: {
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
}): RevisionRow {
  return {
    id: r.id,
    contentId: r.contentId,
    workspaceId: r.workspaceId,
    title: r.title,
    body: r.body,
    hashtags: r.hashtags,
    internalNote: r.internalNote,
    authorName: r.authorName,
    version: r.version,
    createdAt: r.createdAt,
  }
}

export class RevisionsRepository {
  /** List all revisions for a content row, newest first. */
  async listRevisions(contentId: string, workspaceId: string): Promise<RevisionRow[]> {
    const rows = await db.contentRevision.findMany({
      where: { contentId, workspaceId },
      orderBy: { version: 'desc' },
      take: 100,
    })
    return rows.map(toRevisionRow)
  }

  /** Get a single revision scoped to the workspace (object-level tenant auth). */
  async getRevision(
    revisionId: string,
    workspaceId: string
  ): Promise<RevisionRow | null> {
    const row = await db.contentRevision.findFirst({
      where: { id: revisionId, workspaceId },
    })
    return row ? toRevisionRow(row) : null
  }

  /**
   * Create an immutable revision snapshot. The version number is auto-assigned
   * by incrementing the content's highest existing version.
   */
  async createRevision(input: CreateRevisionInput): Promise<RevisionRow> {
    const last = await db.contentRevision.findFirst({
      where: { contentId: input.contentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (last?.version ?? 0) + 1
    const row = await db.contentRevision.create({
      data: {
        contentId: input.contentId,
        workspaceId: input.workspaceId,
        title: input.title,
        body: input.body,
        hashtags: input.hashtags,
        internalNote: input.internalNote,
        authorName: input.authorName,
        version: nextVersion,
      },
    })
    return toRevisionRow(row)
  }

  /**
   * Restore a revision — writes the revision's content back onto the Content
   * row AND creates a NEW revision snapshot (so the audit trail stays
   * append-only). Returns the restored source revision + the new snapshot.
   */
  async restoreRevision(
    revisionId: string,
    workspaceId: string
  ): Promise<{ restored: RevisionRow; snapshot: RevisionRow } | null> {
    const revision = await db.contentRevision.findFirst({
      where: { id: revisionId, workspaceId },
    })
    if (!revision) return null

    // 1. Write the revision's fields back onto the mutable Content row.
    await db.content.update({
      where: { id: revision.contentId },
      data: {
        title: revision.title,
        body: revision.body,
        hashtags: revision.hashtags,
        internalNote: revision.internalNote,
        authorName: revision.authorName,
      },
    })

    // 2. Create a new revision snapshot (append-only audit trail) so the
    // restored state itself becomes a restorable point in history.
    const last = await db.contentRevision.findFirst({
      where: { contentId: revision.contentId },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (last?.version ?? 0) + 1
    const snapshot = await db.contentRevision.create({
      data: {
        contentId: revision.contentId,
        workspaceId,
        title: revision.title,
        body: revision.body,
        hashtags: revision.hashtags,
        internalNote: revision.internalNote,
        authorName: revision.authorName,
        version: nextVersion,
      },
    })

    return { restored: toRevisionRow(revision), snapshot: toRevisionRow(snapshot) }
  }

  /** Get the revision immediately before the given one (same content, lower version). */
  async getPreviousRevision(
    revisionId: string,
    workspaceId: string
  ): Promise<RevisionRow | null> {
    const current = await db.contentRevision.findFirst({
      where: { id: revisionId, workspaceId },
      select: { contentId: true, version: true },
    })
    if (!current) return null
    const prev = await db.contentRevision.findFirst({
      where: {
        contentId: current.contentId,
        workspaceId,
        version: { lt: current.version },
      },
      orderBy: { version: 'desc' },
    })
    return prev ? toRevisionRow(prev) : null
  }
}
