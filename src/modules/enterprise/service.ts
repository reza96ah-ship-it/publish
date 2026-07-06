/**
 * Issue #256: Enterprise — service.
 *
 * Business-logic layer. Validates inputs, calls the repository, and surfaces
 * Persian errors via EnterpriseError subclasses. Audit export returns either
 * a JSON array or a CSV string — the route handler sets the right content
 * type + Content-Disposition header.
 */

import { EnterpriseRepository } from './repository'
import {
  SSOConfigNotFoundError,
  CustomRoleNotFoundError,
  DuplicateRoleError,
  ValidationError,
} from './errors'
import type {
  AuthContext,
  SSOConfigItem,
  CustomRoleItem,
  CreateSSOConfigInput,
  UpdateSSOConfigInput,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
  AuditLogRow,
  AuditExportConfig,
} from './types'

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

export class EnterpriseService {
  constructor(private readonly repo: EnterpriseRepository = new EnterpriseRepository()) {}

  // ── SSO configs ────────────────────────────────────────────────────────────

  listSSOConfigs(auth: AuthContext): Promise<SSOConfigItem[]> {
    return this.repo.listSSOConfigs(auth.workspaceId)
  }

  async createSSOConfig(auth: AuthContext, input: CreateSSOConfigInput): Promise<SSOConfigItem> {
    if (input.provider !== 'saml' && input.provider !== 'oidc') {
      throw new ValidationError('نوع ارائه‌دهنده باید saml یا oidc باشد')
    }
    return this.repo.createSSOConfig(auth.workspaceId, input)
  }

  async updateSSOConfig(
    auth: AuthContext,
    id: string,
    input: UpdateSSOConfigInput
  ): Promise<SSOConfigItem> {
    const existing = await this.repo.findSSOByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SSOConfigNotFoundError()
    return this.repo.updateSSOConfig(id, input)
  }

  async deleteSSOConfig(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findSSOByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new SSOConfigNotFoundError()
    await this.repo.deleteSSOConfig(id)
  }

  // ── Custom roles ───────────────────────────────────────────────────────────

  listCustomRoles(auth: AuthContext): Promise<CustomRoleItem[]> {
    return this.repo.listCustomRoles(auth.workspaceId)
  }

  async createCustomRole(auth: AuthContext, input: CreateCustomRoleInput): Promise<CustomRoleItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('نام نقش الزامی است')
    }
    if (!Array.isArray(input.permissions) || input.permissions.length === 0) {
      throw new ValidationError('حداقل یک دسترسی الزامی است')
    }
    try {
      return await this.repo.createCustomRole(auth.workspaceId, {
        name: input.name.trim(),
        permissions: input.permissions,
        description: input.description ?? null,
      })
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new DuplicateRoleError()
      throw err
    }
  }

  async updateCustomRole(
    auth: AuthContext,
    id: string,
    input: UpdateCustomRoleInput
  ): Promise<CustomRoleItem> {
    const existing = await this.repo.findRoleByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CustomRoleNotFoundError()
    try {
      return await this.repo.updateCustomRole(id, {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.permissions !== undefined ? { permissions: input.permissions } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
      })
    } catch (err) {
      if (isPrismaUniqueViolation(err)) throw new DuplicateRoleError()
      throw err
    }
  }

  async deleteCustomRole(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findRoleByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CustomRoleNotFoundError()
    await this.repo.deleteCustomRole(id)
  }

  // ── Audit export ───────────────────────────────────────────────────────────

  /**
   * Query the AuditLog table for the active workspace + return either a JSON
   * array (default) or a CSV string. The route handler sets the response
   * content type + Content-Disposition based on `format`.
   */
  async exportAuditLogs(
    auth: AuthContext,
    config: AuditExportConfig
  ): Promise<{ format: 'json' | 'csv'; data: AuditLogRow[] | string }> {
    const rows = await this.repo.exportAuditLogs(auth.workspaceId, config)
    if (config.format === 'csv') {
      return { format: 'csv', data: toCSV(rows) }
    }
    return { format: 'json', data: rows }
  }
}

function toCSV(rows: AuditLogRow[]): string {
  const headers = ['id', 'userId', 'workspaceId', 'action', 'resource', 'ipHash', 'createdAt', 'metadata']
  const escape = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [r.id, r.userId, r.workspaceId, r.action, r.resource, r.ipHash, r.createdAt.toISOString(), r.metadata]
        .map(escape)
        .join(',')
    )
  }
  return lines.join('\n')
}

export const enterpriseService = new EnterpriseService()
