/**
 * Issue #255: API Tokens domain module — repository.
 *
 * Data-access layer. The only file in this module that imports `db`.
 * Follows the simple, transaction-free pattern from smart-pages/repository.ts.
 *
 * Ownership invariant: every workspace-scoped query filters by `workspaceId`
 * so a caller can never read or mutate another workspace's tokens. The auth
 * guard already verified the bearer token's `workspaceId`, but we re-check
 * in every repository method to fail closed against any future caller bug.
 *
 * `findByHash` is the ONE workspace-agnostic lookup — used by the auth guard
 * to resolve a bearer token to its workspace. It includes the workspace so
 * the guard can return both in one DB round-trip.
 */

import { db } from '@/lib/db'
import type { ApiTokenItem } from './types'

// ── Row → Item mapper ────────────────────────────────────────────────────────
//
// Strips `tokenHash` (never sent over the wire — it's a secret even though
// it's hashed) and `createdById` (internal). Keeps `prefix` for UI display
// so the admin can identify a token by its first 12 chars without seeing
// the full secret.

function toItem(row: {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: Date | null
  expiresAt: Date | null
  revokedAt: Date | null
  createdAt: Date
}): ApiTokenItem {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    scopes: row.scopes,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  }
}

export class ApiTokensRepository {
  /** List all tokens for a workspace (newest first). */
  async list(workspaceId: string): Promise<ApiTokenItem[]> {
    const rows = await db.apiToken.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    })
    return rows.map(toItem)
  }

  /** Find a single token within a workspace (ownership check). */
  async findByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<ApiTokenItem | null> {
    const row = await db.apiToken.findFirst({
      where: { id, workspaceId },
    })
    return row ? toItem(row) : null
  }

  /**
   * Look up a token by its SHA-256 hash. This is the auth-guard entry point
   * — it includes the workspace so the guard can return both in one trip.
   * NOT workspace-scoped: we don't know the workspace until we resolve the
   * token. Returns the full Prisma row (including tokenHash + workspace).
   */
  async findByHash(tokenHash: string) {
    return db.apiToken.findUnique({
      where: { tokenHash },
      include: { workspace: true },
    })
  }

  /**
   * Create a new token row. Caller MUST have pre-hashed the plaintext and
   * converted any ISO-8601 expiry string to a Date.
   */
  async create(
    workspaceId: string,
    createdById: string,
    data: { name: string; scopes: string[]; expiresAt: Date | null },
    tokenHash: string,
    prefix: string
  ): Promise<ApiTokenItem> {
    const row = await db.apiToken.create({
      data: {
        workspaceId,
        createdById,
        name: data.name,
        tokenHash,
        prefix,
        scopes: data.scopes,
        expiresAt: data.expiresAt,
      },
    })
    return toItem(row)
  }

  /** Fire-and-forget timestamp update — caller does not await this. */
  async updateLastUsed(id: string): Promise<void> {
    await db.apiToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
  }

  /** Soft-revoke: sets revokedAt but keeps the row for audit. */
  async revoke(id: string, workspaceId: string): Promise<void> {
    await db.apiToken.updateMany({
      where: { id, workspaceId },
      data: { revokedAt: new Date() },
    })
  }

  /** Hard delete a token (irreversible). Ownership checked in the service. */
  async delete(id: string, workspaceId: string): Promise<void> {
    await db.apiToken.deleteMany({ where: { id, workspaceId } })
  }
}
