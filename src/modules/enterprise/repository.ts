/**
 * Issue #256: Enterprise — repository.
 *
 * Data-access layer. The ONLY file in this module that imports `db`
 * (architecture rule). SSOConfig + CustomRole have their own Prisma
 * models; the audit-export helper queries the existing AuditLog table.
 *
 * Row → Item mappers coerce Prisma's types to the typed shapes exported
 * from ./types. JSON columns (metadata) are passed through unchanged —
 * the service layer is responsible for any structural validation.
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  SSOConfigItem,
  CustomRoleItem,
  AuditLogRow,
  AuditExportConfig,
  CreateSSOConfigInput,
  UpdateSSOConfigInput,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
} from './types'

function toSSOConfig(row: {
  id: string
  workspaceId: string
  provider: string
  entityId: string | null
  certificate: string | null
  metadataUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}): SSOConfigItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    provider: row.provider as SSOConfigItem['provider'],
    entityId: row.entityId,
    certificate: row.certificate,
    metadataUrl: row.metadataUrl,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toCustomRole(row: {
  id: string
  workspaceId: string
  name: string
  permissions: string[]
  description: string | null
  createdAt: Date
  updatedAt: Date
}): CustomRoleItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    permissions: row.permissions ?? [],
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export class EnterpriseRepository {
  // ── SSO configs ────────────────────────────────────────────────────────────

  listSSOConfigs(workspaceId: string): Promise<SSOConfigItem[]> {
    return db.sSOConfig.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map(toSSOConfig))
  }

  findSSOByIdInWorkspace(id: string, workspaceId: string): Promise<SSOConfigItem | null> {
    return db.sSOConfig.findFirst({ where: { id, workspaceId } }).then((r) => (r ? toSSOConfig(r) : null))
  }

  createSSOConfig(workspaceId: string, data: CreateSSOConfigInput): Promise<SSOConfigItem> {
    return db.sSOConfig
      .create({
        data: {
          workspaceId,
          provider: data.provider,
          entityId: data.entityId ?? null,
          certificate: data.certificate ?? null,
          metadataUrl: data.metadataUrl ?? null,
          isActive: data.isActive ?? false,
        },
      })
      .then(toSSOConfig)
  }

  updateSSOConfig(id: string, data: UpdateSSOConfigInput): Promise<SSOConfigItem> {
    const patch: Prisma.SSOConfigUpdateInput = {}
    if (data.provider !== undefined) patch.provider = data.provider
    if (data.entityId !== undefined) patch.entityId = data.entityId
    if (data.certificate !== undefined) patch.certificate = data.certificate
    if (data.metadataUrl !== undefined) patch.metadataUrl = data.metadataUrl
    if (data.isActive !== undefined) patch.isActive = data.isActive
    return db.sSOConfig.update({ where: { id }, data: patch }).then(toSSOConfig)
  }

  deleteSSOConfig(id: string): Promise<void> {
    return db.sSOConfig.delete({ where: { id } }).then(() => undefined)
  }

  // ── Custom roles ───────────────────────────────────────────────────────────

  listCustomRoles(workspaceId: string): Promise<CustomRoleItem[]> {
    return db.customRole.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map(toCustomRole))
  }

  findRoleByIdInWorkspace(id: string, workspaceId: string): Promise<CustomRoleItem | null> {
    return db.customRole.findFirst({ where: { id, workspaceId } }).then((r) => (r ? toCustomRole(r) : null))
  }

  createCustomRole(workspaceId: string, data: CreateCustomRoleInput): Promise<CustomRoleItem> {
    return db.customRole
      .create({
        data: {
          workspaceId,
          name: data.name,
          permissions: data.permissions,
          description: data.description ?? null,
        },
      })
      .then(toCustomRole)
  }

  updateCustomRole(id: string, data: UpdateCustomRoleInput): Promise<CustomRoleItem> {
    const patch: Prisma.CustomRoleUpdateInput = {}
    if (data.name !== undefined) patch.name = data.name
    if (data.permissions !== undefined) patch.permissions = data.permissions
    if (data.description !== undefined) patch.description = data.description
    return db.customRole.update({ where: { id }, data: patch }).then(toCustomRole)
  }

  deleteCustomRole(id: string): Promise<void> {
    return db.customRole.delete({ where: { id } }).then(() => undefined)
  }

  // ── Audit logs ─────────────────────────────────────────────────────────────

  async exportAuditLogs(workspaceId: string, config: AuditExportConfig): Promise<AuditLogRow[]> {
    const where: Prisma.AuditLogWhereInput = {
      workspaceId,
      ...(config.action ? { action: config.action } : {}),
      ...(config.userId ? { userId: config.userId } : {}),
      ...(config.startDate || config.endDate
        ? {
            createdAt: {
              ...(config.startDate ? { gte: config.startDate } : {}),
              ...(config.endDate ? { lte: config.endDate } : {}),
            },
          }
        : {}),
    }
    const rows = await db.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: config.limit,
    })
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      workspaceId: r.workspaceId,
      action: r.action,
      resource: r.resource,
      metadata: r.metadata,
      ipHash: r.ipHash,
      createdAt: r.createdAt,
    }))
  }
}
