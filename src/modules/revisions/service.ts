/**
 * Issue #212: Content versioning + revision history — service.
 *
 * Business-logic layer. Validates inputs, calls the repository for data, and
 * surfaces Persian errors via RevisionError subclasses. The service is the
 * only place where createRevision is called during the review/approval flow
 * — route handlers in /api/content/[id]/{submit-review,approve,reject}
 * delegate to it so every state transition gets an immutable snapshot.
 */

import { RevisionsRepository } from './repository'
import {
  RevisionNotFoundError,
  ContentNotFoundError,
} from './errors'
import type {
  AuthContext,
  RevisionRow,
  RevisionPayload,
  CreateRevisionInput,
  RevisionDiff,
  FieldDiff,
  RestoreResult,
} from './types'

function toPayload(r: RevisionRow): RevisionPayload {
  return {
    id: r.id,
    contentId: r.contentId,
    title: r.title,
    body: r.body,
    hashtags: r.hashtags,
    internalNote: r.internalNote,
    authorName: r.authorName,
    version: r.version,
    createdAt: r.createdAt.toISOString(),
  }
}

const DIFF_FIELDS: Array<{ key: keyof RevisionRow; label: string }> = [
  { key: 'title', label: 'عنوان' },
  { key: 'body', label: 'متن' },
  { key: 'hashtags', label: 'هشتگ‌ها' },
  { key: 'internalNote', label: 'یادداشت داخلی' },
  { key: 'authorName', label: 'نویسنده' },
]

export class RevisionsService {
  constructor(private readonly repo: RevisionsRepository = new RevisionsRepository()) {}

  async listRevisions(
    auth: AuthContext,
    contentId: string
  ): Promise<RevisionPayload[]> {
    const rows = await this.repo.listRevisions(contentId, auth.workspaceId)
    return rows.map(toPayload)
  }

  async getRevision(
    auth: AuthContext,
    revisionId: string
  ): Promise<RevisionPayload> {
    const row = await this.repo.getRevision(revisionId, auth.workspaceId)
    if (!row) throw new RevisionNotFoundError()
    return toPayload(row)
  }

  /**
   * Create an immutable revision snapshot. Called by the review/approve/reject
   * route handlers on every state transition so the audit trail captures the
   * content's exact state at that moment.
   */
  async createRevision(input: CreateRevisionInput): Promise<RevisionPayload> {
    const row = await this.repo.createRevision(input)
    return toPayload(row)
  }

  /**
   * Restore a revision — writes its content back onto the Content row AND
   * creates a new revision snapshot (append-only). Returns both the restored
   * source revision and the new snapshot.
   */
  async restoreRevision(
    auth: AuthContext,
    revisionId: string
  ): Promise<RestoreResult> {
    const result = await this.repo.restoreRevision(revisionId, auth.workspaceId)
    if (!result) throw new RevisionNotFoundError()
    return {
      revision: toPayload(result.restored),
      newRevision: toPayload(result.snapshot),
    }
  }

  /**
   * Field-level diff between a revision and its immediate predecessor.
   * Returns an array of { field, from, to, changed } for the UI to render.
   * For the very first revision (no predecessor), all fields are reported as
   * "changed from null".
   */
  async getRevisionDiff(
    auth: AuthContext,
    revisionId: string
  ): Promise<RevisionDiff> {
    const revision = await this.repo.getRevision(revisionId, auth.workspaceId)
    if (!revision) throw new RevisionNotFoundError()
    const previous = await this.repo.getPreviousRevision(revisionId, auth.workspaceId)

    const fields: FieldDiff[] = DIFF_FIELDS.map(({ key, label }) => {
      const to = (revision[key] as string | null) ?? null
      const from = (previous?.[key] as string | null) ?? null
      return {
        field: label,
        from,
        to,
        changed: from !== to,
      }
    })

    return {
      revisionId,
      previousRevisionId: previous?.id ?? null,
      fields,
      changedCount: fields.filter((f) => f.changed).length,
    }
  }
}

/** Re-export for route handlers that need to translate "content not found". */
export { ContentNotFoundError }

export const revisionsService = new RevisionsService()
