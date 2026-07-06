/**
 * Issue #256: Enterprise SSO + custom roles + audit export — types.
 *
 * SSOConfig stores provider metadata (SAML entity ID / OIDC metadata URL).
 * CustomRole is a named bundle of permission strings (e.g. "content:create",
 * "inbox.reply") that the auth layer can grant to a workspace member.
 * AuditExportConfig drives the audit-log export endpoint (JSON or CSV).
 *
 * SSOConfig + CustomRole have their own Prisma models; the audit-export
 * endpoint queries the existing AuditLog table (no new model needed).
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export type SSOProvider = 'saml' | 'oidc'

export interface SSOConfigItem {
  id: string
  workspaceId: string
  provider: SSOProvider
  entityId: string | null
  certificate: string | null
  metadataUrl: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CustomRoleItem {
  id: string
  workspaceId: string
  name: string
  permissions: string[]
  description: string | null
  createdAt: Date
  updatedAt: Date
}

export interface AuditExportConfig {
  format: 'json' | 'csv'
  startDate?: Date
  endDate?: Date
  action?: string
  userId?: string
  limit: number
}

export interface AuditLogRow {
  id: string
  userId: string | null
  workspaceId: string | null
  action: string
  resource: string
  metadata: unknown
  ipHash: string | null
  createdAt: Date
}

// ── Service inputs ───────────────────────────────────────────────────────────

export interface CreateSSOConfigInput {
  provider: SSOProvider
  entityId?: string | null
  certificate?: string | null
  metadataUrl?: string | null
  isActive?: boolean
}

export type UpdateSSOConfigInput = Partial<CreateSSOConfigInput>

export interface CreateCustomRoleInput {
  name: string
  permissions: string[]
  description?: string | null
}

export type UpdateCustomRoleInput = Partial<CreateCustomRoleInput>
