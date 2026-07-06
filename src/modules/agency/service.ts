/**
 * Issue #254: Agency multi-client overview domain module — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts + listening/service.ts
 * pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Workspace-scoped (auth) entry points verify ownership via the agency
 *     profile's `workspaceId`.
 *   - Throws domain errors (AgencyError subclasses) — route handlers map them
 *     to HTTP via `instanceof AgencyError`.
 *
 * One PUBLIC (no-auth) entry point exists for the client portal:
 *   - getPortalAccess(token) — validates token + expiry + isActive, returns the
 *     client workspace + permissions + pending content. Used by the
 *     /api/agency/portal/[token] route.
 */

import { randomBytes } from 'crypto'
import { AgencyRepository } from './repository'
import {
  AgencyNotFoundError,
  TemplateNotFoundError,
  PortalAccessNotFoundError,
  ValidationError,
} from './errors'
import type {
  AgencyOverview,
  AgencyProfileItem,
  AuthContext,
  ClientPortalAccessItem,
  ClientWorkspaceSummary,
  CreateTemplateInput,
  PublicPortalPayload,
  UpdateAgencyProfileInput,
  UpdateTemplateInput,
  WorkspaceTemplateItem,
} from './types'

/**
 * Detect a Prisma unique-constraint violation (P2002) without importing Prisma.
 * Mirrors smart-pages/service.ts:isPrismaUniqueViolation.
 */
function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 'P2002'
  )
}

/** Valid permission strings a portal access token may carry. */
const ALLOWED_PERMISSIONS = new Set([
  'content:view',
  'content:approve',
  'content:comment',
])

export class AgencyService {
  constructor(private readonly repo: AgencyRepository = new AgencyRepository()) {}

  // ── Agency profile ─────────────────────────────────────────────────────────

  /** Get the agency profile for the active workspace (or null if not set up). */
  async getProfile(auth: AuthContext): Promise<AgencyProfileItem | null> {
    return this.repo.getAgencyProfile(auth.workspaceId)
  }

  /**
   * Set up the agency profile for the active workspace. Idempotent: if a
   * profile already exists, returns it unchanged. White-label fields default
   * to null/false (the agency can set them via updateProfile later).
   */
  async setupAgency(auth: AuthContext): Promise<AgencyProfileItem> {
    const existing = await this.repo.getAgencyProfile(auth.workspaceId)
    if (existing) return existing
    return this.repo.createAgencyProfile(auth.workspaceId, {})
  }

  /**
   * Update white-label settings + client list. Caller MUST have a profile —
   * setupAgency() must be called first.
   */
  async updateProfile(
    auth: AuthContext,
    input: UpdateAgencyProfileInput
  ): Promise<AgencyProfileItem> {
    const existing = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!existing) throw new AgencyNotFoundError()

    if (input.clientWorkspaceIds !== undefined) {
      // Validate that all client workspace IDs are non-empty strings.
      for (const id of input.clientWorkspaceIds) {
        if (typeof id !== 'string' || id.trim().length === 0) {
          throw new ValidationError('شناسه فضای کار مشتری نامعتبر است')
        }
      }
    }

    if (input.brandName !== undefined && input.brandName !== null && input.brandName.length > 100) {
      throw new ValidationError('نام برند نباید از ۱۰۰ کاراکتر بیشتر باشد')
    }
    if (
      input.brandLogoUrl !== undefined &&
      input.brandLogoUrl !== null &&
      input.brandLogoUrl.length > 500
    ) {
      throw new ValidationError('آدرس لوگوی برند خیلی طولانی است')
    }

    return this.repo.updateAgencyProfile(auth.workspaceId, input)
  }

  // ── Agency overview + client list ──────────────────────────────────────────

  /** Aggregated dashboard rollup: client count, pending approvals, at-risk, renewals, usage. */
  async getOverview(auth: AuthContext): Promise<AgencyOverview> {
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()
    return this.repo.getAgencyOverview(profile.clientWorkspaceIds)
  }

  /** List all client workspaces with per-client summary stats. */
  async listClients(auth: AuthContext): Promise<ClientWorkspaceSummary[]> {
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()
    return this.repo.listClientWorkspaces(profile.clientWorkspaceIds)
  }

  // ── Templates ──────────────────────────────────────────────────────────────

  async listTemplates(auth: AuthContext): Promise<WorkspaceTemplateItem[]> {
    return this.repo.listTemplates(auth.workspaceId)
  }

  async createTemplate(
    auth: AuthContext,
    input: CreateTemplateInput
  ): Promise<WorkspaceTemplateItem> {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('نام قالب الزامی است')
    }
    if (!input.template || typeof input.template !== 'object') {
      throw new ValidationError('پیکربندی قالب نامعتبر است')
    }
    return this.repo.createTemplate(auth.workspaceId, input)
  }

  async updateTemplate(
    auth: AuthContext,
    id: string,
    input: UpdateTemplateInput
  ): Promise<WorkspaceTemplateItem> {
    const existing = await this.repo.findTemplateByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new TemplateNotFoundError()
    try {
      return this.repo.updateTemplate(id, input)
    } catch (err) {
      if (isPrismaUniqueViolation(err)) {
        throw new ValidationError('قالب با این نام قبلاً ثبت شده است')
      }
      throw err
    }
  }

  async deleteTemplate(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findTemplateByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new TemplateNotFoundError()
    await this.repo.deleteTemplate(id)
  }

  /**
   * Create a new client workspace from a template. The template's brand colors,
   * plan, etc. are applied as the new workspace's defaults; the new workspace
   * ID is appended to the agency's clientWorkspaceIds list.
   */
  async createClientFromTemplate(
    auth: AuthContext,
    templateId: string,
    clientName: string
  ): Promise<{ workspaceId: string }> {
    if (!clientName || clientName.trim().length === 0) {
      throw new ValidationError('نام مشتری الزامی است')
    }
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()

    const template = await this.repo.findTemplateByIdInWorkspace(templateId, auth.workspaceId)
    if (!template) throw new TemplateNotFoundError()

    return this.repo.createClientWorkspace(auth.workspaceId, clientName.trim(), template.template)
  }

  // ── Portal access ──────────────────────────────────────────────────────────

  /**
   * List portal-access tokens for all of the agency's clients.
   * (One query against all client workspace IDs — service-level filtering.)
   */
  async listPortalAccess(auth: AuthContext): Promise<ClientPortalAccessItem[]> {
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()
    return this.repo.listPortalAccessForWorkspaces(profile.clientWorkspaceIds)
  }

  /**
   * Generate a portal-access token for a client workspace. Caller must verify
   * the workspaceId is one of the agency's clients — we trust the auth guard
   * for that (workspace.settings permission implies agency-admin).
   */
  async createPortalAccess(
    auth: AuthContext,
    workspaceId: string,
    permissions: string[],
    expiresAt?: Date | null
  ): Promise<ClientPortalAccessItem> {
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()

    if (!profile.clientWorkspaceIds.includes(workspaceId)) {
      throw new ValidationError('فضای کار مورد نظر متعلق به مشتریان این آژانس نیست')
    }

    if (!Array.isArray(permissions) || permissions.length === 0) {
      throw new ValidationError('حداقل یک دسترسی الزامی است')
    }
    for (const p of permissions) {
      if (!ALLOWED_PERMISSIONS.has(p)) {
        throw new ValidationError(`دسترسی نامعتبر: ${p}`)
      }
    }

    // 32-char hex token (128 bits of entropy) — mirrors the listening shareToken.
    const accessToken = randomBytes(16).toString('hex')

    return this.repo.createPortalAccess({
      workspaceId,
      permissions,
      accessToken,
      expiresAt: expiresAt ?? null,
    })
  }

  /** Revoke a portal-access token (sets isActive=false; row is preserved for audit). */
  async revokePortalAccess(auth: AuthContext, id: string): Promise<void> {
    const profile = await this.repo.getAgencyProfile(auth.workspaceId)
    if (!profile) throw new AgencyNotFoundError()

    const access = await this.repo.getPortalAccessById(id)
    if (!access) throw new PortalAccessNotFoundError()
    if (!profile.clientWorkspaceIds.includes(access.workspaceId)) {
      // Don't leak existence of tokens for workspaces this agency doesn't manage.
      throw new PortalAccessNotFoundError()
    }
    await this.repo.revokePortalAccess(id)
  }

  /**
   * PUBLIC: validate a portal-access token and return the client workspace +
   * permissions + pending content. NO auth context — anyone with the URL can
   * call this. The token itself is the credential.
   *
   * Validation: token exists, isActive=true, expiresAt (if set) is in the future.
   * Fire-and-forget updates lastAccessedAt so a failed write doesn't break the
   * read.
   */
  async getPortalAccess(token: string): Promise<PublicPortalPayload | null> {
    if (!token || token.length < 16 || token.length > 100) return null

    const access = await this.repo.findPortalAccessByToken(token)
    if (!access || !access.isActive) return null
    if (access.expiresAt && access.expiresAt.getTime() < Date.now()) return null

    // Fire-and-forget — a failed timestamp write should not break the portal.
    this.repo.touchPortalAccess(access.id).catch(() => {})

    const pendingContent = await this.repo.listClientPendingContent(access.workspaceId)

    return {
      workspace: {
        id: access.workspaceId,
        name: access.workspaceName,
        brandPrimaryColor: access.brandPrimaryColor,
        brandAccentColor: access.brandAccentColor,
      },
      permissions: access.permissions,
      pendingContent,
    }
  }
}

export const agencyService = new AgencyService()
