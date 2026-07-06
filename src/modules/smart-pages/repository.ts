/**
 * Issue #250: Smart Pages domain module — repository.
 *
 * Data-access layer. The only file in this module that imports `db`.
 * Follows the simple, transaction-free pattern from notifications/repository.ts.
 *
 * Cursor pagination: `list()` takes `limit + 1` rows so the service can derive
 * `nextCursor`; rows are ordered by createdAt desc, so cursor compares with `lt`.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  SmartPageBlock,
  SmartPageItem,
  SmartPageListQuery,
  CreateSmartPageInput,
  UpdateSmartPageInput,
  ClickInput,
  ClickStat,
} from './types'

// ── Row → Item mapper ────────────────────────────────────────────────────────
//
// Prisma returns `blocks` as `Prisma.JsonValue`. At runtime it is the array we
// stored; we coerce to the discriminated-union type the rest of the app uses.

function toItem(row: {
  id: string
  workspaceId: string
  slug: string
  title: string
  description: string | null
  avatarUrl: string | null
  blocks: Prisma.JsonValue
  isPublished: boolean
  views: number
  clicks: number
  createdAt: Date
  updatedAt: Date
}): SmartPageItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    title: row.title,
    description: row.description,
    avatarUrl: row.avatarUrl,
    blocks: (Array.isArray(row.blocks) ? row.blocks : []) as SmartPageBlock[],
    isPublished: row.isPublished,
    views: row.views,
    clicks: row.clicks,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class SmartPagesRepository {
  /**
   * List smart pages for a workspace, cursor-paginated by createdAt desc.
   * Returns `limit + 1` rows so the service can detect a next page.
   */
  async list(workspaceId: string, query: SmartPageListQuery): Promise<SmartPageItem[]> {
    const limit = query.limit ?? 20
    const rows = await db.smartPage.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return rows.map(toItem)
  }

  /** Find a single page within a workspace (ownership check). */
  async findByIdInWorkspace(id: string, workspaceId: string): Promise<SmartPageItem | null> {
    const row = await db.smartPage.findFirst({
      where: { id, workspaceId },
    })
    return row ? toItem(row) : null
  }

  /**
   * Find a published/unpublished page by slug (PUBLIC — no workspace filter).
   * Includes the workspace so the service can surface brand colors.
   */
  async findBySlug(slug: string): Promise<
    | (SmartPageItem & {
        brandPrimaryColor: string
        brandAccentColor: string
        workspaceName: string
      })
    | null
  > {
    const row = await db.smartPage.findFirst({
      where: { slug },
      include: { workspace: true },
    })
    if (!row) return null
    return {
      ...toItem(row),
      brandPrimaryColor: row.workspace.brandPrimaryColor,
      brandAccentColor: row.workspace.brandAccentColor,
      workspaceName: row.workspace.name,
    }
  }

  /**
   * Find a smart page by slug within a workspace (for slug-uniqueness checks
   * during create/update). Different workspaces may reuse the same slug.
   */
  async findBySlugInWorkspace(
    slug: string,
    workspaceId: string
  ): Promise<SmartPageItem | null> {
    const row = await db.smartPage.findFirst({
      where: { slug, workspaceId },
    })
    return row ? toItem(row) : null
  }

  /** Create a new smart page. Throws Prisma P2002 on [workspaceId, slug] conflict. */
  async create(workspaceId: string, data: CreateSmartPageInput): Promise<SmartPageItem> {
    const row = await db.smartPage.create({
      data: {
        workspaceId,
        slug: data.slug,
        title: data.title,
        description: data.description ?? null,
        avatarUrl: data.avatarUrl ?? null,
        blocks: (data.blocks ?? []) as Prisma.InputJsonValue,
        isPublished: data.isPublished ?? false,
      },
    })
    return toItem(row)
  }

  /**
   * Update a smart page. Caller MUST have verified ownership first via
   * findByIdInWorkspace — we trust the `id` here. Throws P2002 on slug conflict.
   */
  async update(id: string, data: UpdateSmartPageInput): Promise<SmartPageItem> {
    const row = await db.smartPage.update({
      where: { id },
      data: {
        ...(data.slug !== undefined ? { slug: data.slug } : {}),
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.blocks !== undefined
          ? { blocks: data.blocks as Prisma.InputJsonValue }
          : {}),
        ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
      },
    })
    return toItem(row)
  }

  /** Delete a smart page. Caller MUST have verified ownership first. */
  async delete(id: string): Promise<void> {
    await db.smartPage.delete({ where: { id } })
  }

  /** Atomically increment the views counter (fire-and-forget friendly). */
  async incrementViews(id: string): Promise<void> {
    await db.smartPage.update({
      where: { id },
      data: { views: { increment: 1 } },
    })
  }

  /**
   * Record a click event + increment the page's clicks counter.
   * Two writes — but no transaction needed: a missed increment on a race is
   * acceptable for analytics counters, and the click row is the source of truth.
   */
  async recordClick(smartPageId: string, input: ClickInput): Promise<void> {
    await db.smartPageClick.create({
      data: {
        smartPageId,
        blockId: input.blockId,
        blockType: input.blockType,
        label: input.label,
        url: input.url,
        referrer: input.referrer ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    await db.smartPage.update({
      where: { id: smartPageId },
      data: { clicks: { increment: 1 } },
    })
  }

  /**
   * Daily click counts for the last `days` days, oldest first.
   * Uses Prisma `groupBy` on a date-truncated SQL expression. Implemented with
   * raw SQL because Prisma doesn't support date-trunc cross-DB in groupBy.
   *
   * Returns rows for every day in the range (zero-filled for missing days).
   */
  async getClickStats(smartPageId: string, days: number): Promise<ClickStat[]> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))

    const rows = await db.smartPageClick.findMany({
      where: { smartPageId, clickedAt: { gte: since } },
      select: { clickedAt: true },
    })

    // Bucket clicks by YYYY-MM-DD in JS (avoids dialect-specific SQL).
    const buckets = new Map<string, number>()
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      buckets.set(toDayKey(d), 0)
    }
    for (const row of rows) {
      const key = toDayKey(row.clickedAt)
      buckets.set(key, (buckets.get(key) ?? 0) + 1)
    }

    return Array.from(buckets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, clicks]) => ({ date, clicks }))
  }
}

function toDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
