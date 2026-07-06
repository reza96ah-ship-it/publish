/**
 * Issue #250: Smart Pages domain module — service.
 *
 * Business-logic layer. Follows the campaigns/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Cursor pagination handled in the service: repo returns `limit+1` rows,
 *     service slices + derives `nextCursor`.
 *   - Throws domain errors (SmartPageError subclasses) — route handler maps
 *     them to HTTP via `instanceof SmartPageError`.
 *
 * Two public (no-auth) entry points exist for visitor-facing reads:
 *   - findBySlug(slug) — returns page + workspace brand colors, increments views
 *   - recordClick(slug, input) — records a click event, increments clicks counter
 */

import { SmartPagesRepository } from './repository'
import {
  SmartPageNotFoundError,
  SlugConflictError,
} from './errors'
import type {
  AuthContext,
  SmartPageListQuery,
  SmartPageListResult,
  SmartPageItem,
  PublicSmartPageItem,
  CreateSmartPageInput,
  UpdateSmartPageInput,
  ClickInput,
  ClickStat,
} from './types'

const DEFAULT_LIMIT = 20

/**
 * Detect a Prisma unique-constraint violation (P2002) without importing Prisma.
 * Same shape as membership/service.ts:isPrismaUniqueViolation.
 */
function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

export class SmartPagesService {
  constructor(
    private readonly repo: SmartPagesRepository = new SmartPagesRepository()
  ) {}

  // ── Workspace-scoped (auth required) ───────────────────────────────────────

  /** List smart pages for the active workspace, cursor-paginated. */
  async listSmartPages(
    auth: AuthContext,
    query: SmartPageListQuery
  ): Promise<SmartPageListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.list(auth.workspaceId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  /**
   * Create a new smart page. Slug uniqueness is enforced by the
   * @@unique([workspaceId, slug]) — a violation is mapped to SlugConflictError.
   */
  async createSmartPage(
    auth: AuthContext,
    input: CreateSmartPageInput
  ): Promise<SmartPageItem> {
    try {
      return await this.repo.create(auth.workspaceId, input)
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new SlugConflictError()
      }
      throw err
    }
  }

  /**
   * Update a smart page. Verifies ownership (page belongs to the workspace)
   * and slug uniqueness if slug is being changed.
   */
  async updateSmartPage(
    auth: AuthContext,
    id: string,
    input: UpdateSmartPageInput
  ): Promise<SmartPageItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SmartPageNotFoundError()

    // If renaming the slug, ensure no other page in this workspace has it.
    if (input.slug !== undefined && input.slug !== existing.slug) {
      const conflict = await this.repo.findBySlugInWorkspace(
        input.slug,
        auth.workspaceId
      )
      if (conflict && conflict.id !== existing.id) {
        throw new SlugConflictError()
      }
    }

    try {
      return await this.repo.update(id, input)
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new SlugConflictError()
      }
      throw err
    }
  }

  /** Delete a smart page. Verifies ownership first. */
  async deleteSmartPage(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SmartPageNotFoundError()
    await this.repo.delete(id)
  }

  /** Get a single smart page (admin view). Verifies ownership. */
  async getSmartPage(auth: AuthContext, id: string): Promise<SmartPageItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SmartPageNotFoundError()
    return existing
  }

  /** Daily click counts for the last `days` days (default 30). */
  async getClickStats(
    auth: AuthContext,
    id: string,
    days = 30
  ): Promise<ClickStat[]> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SmartPageNotFoundError()
    return this.repo.getClickStats(id, days)
  }

  // ── Public (no auth) ───────────────────────────────────────────────────────
  //
  // These are called by the public /p/[slug] page and its click-tracking beacon.
  // They look up by slug (globally unique within published pages) and do not
  // require any workspace context.

  /**
   * Public: fetch a smart page by slug + increment its view counter.
   * Returns the page with the workspace's brand colors.
   */
  async findBySlug(slug: string): Promise<PublicSmartPageItem> {
    const page = await this.repo.findBySlug(slug)
    if (!page) throw new SmartPageNotFoundError()
    // Increment views fire-and-forget — a failed write should not break the
    // public read. await is intentional so errors surface in dev logs.
    await this.repo.incrementViews(page.id).catch(() => {})
    return page
  }

  /**
   * Public: record a click on a block of a smart page identified by slug.
   * Increments both the click-event log and the page's clicks counter.
   */
  async recordClick(slug: string, input: ClickInput): Promise<void> {
    const page = await this.repo.findBySlug(slug)
    if (!page) throw new SmartPageNotFoundError()
    await this.repo.recordClick(page.id, input)
  }
}

export const smartPagesService = new SmartPagesService()
