/**
 * Issue #254: Agency multi-client overview domain module — repository.
 *
 * Data-access layer. The ONLY file in this module that imports `db`.
 * Follows the same pattern as smart-pages/repository.ts + listening/repository.ts.
 *
 * The agency's own workspace holds an AgencyProfile row (1:1). The profile's
 * `clientWorkspaceIds` is an array of foreign workspace IDs. To list clients
 * we issue ONE db.workspace.findMany({ where: { id: { in: [...] } } }) and
 * parallel count() calls for per-client stats. Aggregated overview uses groupBy
 * across all client workspaces in a single query.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  AgencyProfileItem,
  AgencyOverview,
  ClientPortalAccessItem,
  ClientWorkspaceSummary,
  CreatePortalAccessInput,
  CreateTemplateInput,
  UpdateAgencyProfileInput,
  UpdateTemplateInput,
  WorkspaceTemplateConfig,
  WorkspaceTemplateItem,
  PublicPortalPayload,
} from './types'

// ── Row → Item mappers ───────────────────────────────────────────────────────

function profileToItem(row: {
  id: string
  workspaceId: string
  isAgency: boolean
  clientWorkspaceIds: string[]
  brandName: string | null
  brandLogoUrl: string | null
  hideNashrinoBranding: boolean
  createdAt: Date
  updatedAt: Date
}): AgencyProfileItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    isAgency: row.isAgency,
    clientWorkspaceIds: row.clientWorkspaceIds,
    brandName: row.brandName,
    brandLogoUrl: row.brandLogoUrl,
    hideNashrinoBranding: row.hideNashrinoBranding,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function templateToItem(row: {
  id: string
  workspaceId: string
  name: string
  description: string | null
  template: Prisma.JsonValue
  createdAt: Date
  updatedAt: Date
}): WorkspaceTemplateItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    template: (row.template ?? {}) as WorkspaceTemplateConfig,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function portalToItem(row: {
  id: string
  workspaceId: string
  accessToken: string
  permissions: string[]
  expiresAt: Date | null
  lastAccessedAt: Date | null
  isActive: boolean
  createdAt: Date
}): ClientPortalAccessItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    accessToken: row.accessToken,
    permissions: row.permissions,
    expiresAt: row.expiresAt,
    lastAccessedAt: row.lastAccessedAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
  }
}

/**
 * Derive a workspace's rollup status from its platforms' statuses.
 * Priority: disconnected > error > expired > active. Workspaces with no
 * platforms at all are "unknown" (the agency likely hasn't connected any
 * channels for them yet).
 */
function rollupStatus(platformStatuses: string[]): ClientWorkspaceSummary['status'] {
  if (platformStatuses.length === 0) return 'unknown'
  if (platformStatuses.includes('disconnected')) return 'disconnected'
  if (platformStatuses.includes('error')) return 'error'
  if (platformStatuses.includes('expired')) return 'expired'
  return 'active'
}

// ── Repository ───────────────────────────────────────────────────────────────

export class AgencyRepository {
  // ── Agency profile ────────────────────────────────────────────────────────

  async getAgencyProfile(workspaceId: string): Promise<AgencyProfileItem | null> {
    const row = await db.agencyProfile.findUnique({ where: { workspaceId } })
    return row ? profileToItem(row) : null
  }

  async createAgencyProfile(
    workspaceId: string,
    data: { brandName?: string | null; brandLogoUrl?: string | null; hideNashrinoBranding?: boolean }
  ): Promise<AgencyProfileItem> {
    const row = await db.agencyProfile.create({
      data: {
        workspaceId,
        isAgency: true,
        brandName: data.brandName ?? null,
        brandLogoUrl: data.brandLogoUrl ?? null,
        hideNashrinoBranding: data.hideNashrinoBranding ?? false,
      },
    })
    return profileToItem(row)
  }

  async updateAgencyProfile(
    workspaceId: string,
    data: UpdateAgencyProfileInput
  ): Promise<AgencyProfileItem> {
    const row = await db.agencyProfile.update({
      where: { workspaceId },
      data: {
        ...(data.brandName !== undefined ? { brandName: data.brandName } : {}),
        ...(data.brandLogoUrl !== undefined ? { brandLogoUrl: data.brandLogoUrl } : {}),
        ...(data.hideNashrinoBranding !== undefined ? { hideNashrinoBranding: data.hideNashrinoBranding } : {}),
        ...(data.clientWorkspaceIds !== undefined ? { clientWorkspaceIds: data.clientWorkspaceIds } : {}),
      },
    })
    return profileToItem(row)
  }

  // ── Client workspaces ─────────────────────────────────────────────────────

  /**
   * Fetch every client workspace of an agency and assemble per-client stats.
   * Issues:
   *   1. findMany for workspace rows (name, plan, category, createdAt)
   *   2. groupBy on Platform (per-workspace platform status counts)
   *   3. groupBy on Content (per-workspace status counts for pendingApprovals +
   *      postsThisMonth + scheduledUpcoming)
   *
   * Workspaces whose ID is in `clientWorkspaceIds` but no longer exist (deleted
   * out-of-band) are silently skipped — the agency UI surfaces a "missing" hint
   * via the count delta if needed.
   */
  async listClientWorkspaces(clientWorkspaceIds: string[]): Promise<ClientWorkspaceSummary[]> {
    if (clientWorkspaceIds.length === 0) return []

    const workspaces = await db.workspace.findMany({
      where: { id: { in: clientWorkspaceIds } },
      select: {
        id: true,
        name: true,
        plan: true,
        category: true,
        createdAt: true,
      },
    })

    if (workspaces.length === 0) return []

    const wsIds = workspaces.map((w) => w.id)

    // Per-workspace platform status counts (one query, grouped).
    const platformGroups = await db.platform.groupBy({
      by: ['workspaceId', 'status'],
      where: { workspaceId: { in: wsIds } },
      _count: { _all: true },
    })
    const platformsByWs = new Map<string, { statuses: string[]; total: number }>()
    for (const g of platformGroups) {
      const entry = platformsByWs.get(g.workspaceId) ?? { statuses: [], total: 0 }
      for (let i = 0; i < g._count._all; i++) entry.statuses.push(g.status)
      entry.total += g._count._all
      platformsByWs.set(g.workspaceId, entry)
    }

    // Per-workspace content stats — pendingApprovals (status='review'),
    // postsThisMonth (publishedAt in current month), scheduledUpcoming
    // (status='scheduled' + scheduledAt > now).
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [pendingGroups, monthGroups, scheduledGroups] = await Promise.all([
      db.content.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds }, status: 'review' },
        _count: { _all: true },
      }),
      db.content.groupBy({
        by: ['workspaceId'],
        where: { workspaceId: { in: wsIds }, publishedAt: { gte: monthStart } },
        _count: { _all: true },
      }),
      db.content.groupBy({
        by: ['workspaceId'],
        where: {
          workspaceId: { in: wsIds },
          status: 'scheduled',
          scheduledAt: { gt: now },
        },
        _count: { _all: true },
      }),
    ])

    const pendingMap = new Map(pendingGroups.map((g) => [g.workspaceId, g._count._all]))
    const monthMap = new Map(monthGroups.map((g) => [g.workspaceId, g._count._all]))
    const scheduledMap = new Map(scheduledGroups.map((g) => [g.workspaceId, g._count._all]))

    return workspaces.map((w) => {
      const plat = platformsByWs.get(w.id) ?? { statuses: [], total: 0 }
      return {
        id: w.id,
        name: w.name,
        plan: w.plan,
        status: rollupStatus(plat.statuses),
        pendingApprovals: pendingMap.get(w.id) ?? 0,
        usageStats: {
          postsThisMonth: monthMap.get(w.id) ?? 0,
          scheduledUpcoming: scheduledMap.get(w.id) ?? 0,
          platforms: plat.total,
        },
        category: w.category,
        createdAt: w.createdAt,
      }
    })
  }

  /**
   * Aggregated dashboard rollup across all client workspaces. Same query
   * pattern as listClientWorkspaces but aggregates instead of partitioning.
   */
  async getAgencyOverview(clientWorkspaceIds: string[]): Promise<AgencyOverview> {
    if (clientWorkspaceIds.length === 0) {
      return {
        totalClients: 0,
        pendingApprovals: 0,
        atRiskClients: 0,
        upcomingRenewals: 0,
        usageSummary: { postsThisMonth: 0, scheduledUpcoming: 0, totalPlatforms: 0 },
      }
    }

    const workspaces = await db.workspace.findMany({
      where: { id: { in: clientWorkspaceIds } },
      select: { id: true, plan: true },
    })
    const wsIds = workspaces.map((w) => w.id)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [pendingAgg, monthAgg, scheduledAgg, platformAgg, atRiskAgg] = await Promise.all([
      db.content.count({
        where: { workspaceId: { in: wsIds }, status: 'review' },
      }),
      db.content.count({
        where: { workspaceId: { in: wsIds }, publishedAt: { gte: monthStart } },
      }),
      db.content.count({
        where: {
          workspaceId: { in: wsIds },
          status: 'scheduled',
          scheduledAt: { gt: now },
        },
      }),
      db.platform.count({ where: { workspaceId: { in: wsIds } } }),
      // At-risk = at least one platform in a non-active state.
      db.platform.findMany({
        where: {
          workspaceId: { in: wsIds },
          status: { in: ['expired', 'error', 'disconnected'] },
        },
        select: { workspaceId: true, status: true },
        distinct: ['workspaceId'],
      }),
    ])

    // Upcoming renewals = paid-plan clients (simplified — no renewal date column).
    // Paid plans: pro, business, enterprise.
    const upcomingRenewals = workspaces.filter(
      (w) => w.plan === 'pro' || w.plan === 'business' || w.plan === 'enterprise'
    ).length

    return {
      totalClients: workspaces.length,
      pendingApprovals: pendingAgg,
      atRiskClients: atRiskAgg.length,
      upcomingRenewals,
      usageSummary: {
        postsThisMonth: monthAgg,
        scheduledUpcoming: scheduledAgg,
        totalPlatforms: platformAgg,
      },
    }
  }

  /**
   * Create a brand-new workspace + (optionally) attach it to the agency's
   * clientWorkspaceIds list. The template config is applied as default
   * workspace settings (brand colors, plan, etc.).
   */
  async createClientWorkspace(
    agencyWorkspaceId: string,
    name: string,
    template: WorkspaceTemplateConfig
  ): Promise<{ workspaceId: string }> {
    const slug = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
    const created = await db.workspace.create({
      data: {
        name,
        slug,
        category: 'agency-client',
        plan: typeof template.plan === 'string' ? template.plan : 'free',
        brandPrimaryColor:
          typeof template.brandPrimaryColor === 'string' ? template.brandPrimaryColor : '#0F766E',
        brandAccentColor:
          typeof template.brandAccentColor === 'string' ? template.brandAccentColor : '#2563EB',
      },
    })

    // Append the new client workspace ID to the agency's profile. Uses a raw
    // PostgreSQL array_cat to avoid a read-modify-write race — but Prisma's
    // array support is dialect-specific, so we do read-modify-write guarded by
    // the @@unique on workspaceId (single row per agency).
    const profile = await db.agencyProfile.findUnique({ where: { workspaceId: agencyWorkspaceId } })
    if (profile) {
      const next = Array.from(new Set([...profile.clientWorkspaceIds, created.id]))
      await db.agencyProfile.update({
        where: { workspaceId: agencyWorkspaceId },
        data: { clientWorkspaceIds: next },
      })
    }

    return { workspaceId: created.id }
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(workspaceId: string): Promise<WorkspaceTemplateItem[]> {
    const rows = await db.workspaceTemplate.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map(templateToItem)
  }

  async findTemplateByIdInWorkspace(
    id: string,
    workspaceId: string
  ): Promise<WorkspaceTemplateItem | null> {
    const row = await db.workspaceTemplate.findFirst({ where: { id, workspaceId } })
    return row ? templateToItem(row) : null
  }

  async createTemplate(
    workspaceId: string,
    data: CreateTemplateInput
  ): Promise<WorkspaceTemplateItem> {
    const row = await db.workspaceTemplate.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description ?? null,
        template: data.template as Prisma.InputJsonValue,
      },
    })
    return templateToItem(row)
  }

  async updateTemplate(
    id: string,
    data: UpdateTemplateInput
  ): Promise<WorkspaceTemplateItem> {
    const row = await db.workspaceTemplate.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.template !== undefined
          ? { template: data.template as Prisma.InputJsonValue }
          : {}),
      },
    })
    return templateToItem(row)
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.workspaceTemplate.delete({ where: { id } })
  }

  // ── Portal access ──────────────────────────────────────────────────────────

  async listPortalAccess(workspaceId: string): Promise<ClientPortalAccessItem[]> {
    // Only returns tokens for the agency's own client workspaces — caller must
    // verify the workspaceId is in clientWorkspaceIds (service layer).
    const rows = await db.clientPortalAccess.findMany({
      where: { workspaceId },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map(portalToItem)
  }

  async listPortalAccessForWorkspaces(workspaceIds: string[]): Promise<ClientPortalAccessItem[]> {
    if (workspaceIds.length === 0) return []
    const rows = await db.clientPortalAccess.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: [{ createdAt: 'desc' }],
    })
    return rows.map(portalToItem)
  }

  async createPortalAccess(
    input: CreatePortalAccessInput & { accessToken: string }
  ): Promise<ClientPortalAccessItem> {
    const row = await db.clientPortalAccess.create({
      data: {
        workspaceId: input.workspaceId,
        accessToken: input.accessToken,
        permissions: input.permissions,
        expiresAt: input.expiresAt ?? null,
        isActive: true,
      },
    })
    return portalToItem(row)
  }

  async getPortalAccessById(id: string): Promise<ClientPortalAccessItem | null> {
    const row = await db.clientPortalAccess.findUnique({ where: { id } })
    return row ? portalToItem(row) : null
  }

  async findPortalAccessByToken(
    token: string
  ): Promise<(ClientPortalAccessItem & { workspaceName: string; brandPrimaryColor: string; brandAccentColor: string }) | null> {
    const row = await db.clientPortalAccess.findUnique({
      where: { accessToken: token },
      include: { workspace: true },
    })
    if (!row) return null
    return {
      ...portalToItem(row),
      workspaceName: row.workspace.name,
      brandPrimaryColor: row.workspace.brandPrimaryColor,
      brandAccentColor: row.workspace.brandAccentColor,
    }
  }

  async touchPortalAccess(id: string): Promise<void> {
    await db.clientPortalAccess.update({
      where: { id },
      data: { lastAccessedAt: new Date() },
    })
  }

  async revokePortalAccess(id: string): Promise<void> {
    await db.clientPortalAccess.update({
      where: { id },
      data: { isActive: false },
    })
  }

  /**
   * PUBLIC: fetch a workspace's pending/approvable content for the client
   * portal. Returns rows ordered by createdAt desc, capped at 20 most recent.
   * Called by getPortalAccess(token) which has already validated the token.
   */
  async listClientPendingContent(workspaceId: string): Promise<PublicPortalPayload['pendingContent']> {
    const rows = await db.content.findMany({
      where: {
        workspaceId,
        status: { in: ['draft', 'review', 'scheduled', 'approved'] },
      },
      select: {
        id: true,
        title: true,
        status: true,
        scheduledAt: true,
        authorName: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
      take: 20,
    })
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      scheduledAt: r.scheduledAt ? r.scheduledAt.toISOString() : null,
      authorName: r.authorName,
      createdAt: r.createdAt.toISOString(),
    }))
  }
}
