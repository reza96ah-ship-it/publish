/**
 * Issue #254: Agency multi-client overview domain module — types.
 *
 * An agency workspace manages multiple client workspaces. This module exposes:
 *   - AgencyProfile (white-label settings + list of client workspace IDs)
 *   - ClientWorkspaceSummary (per-client rollup: plan, status, pendingApprovals,
 *     usageStats) — assembled by querying each client workspace's tables
 *   - WorkspaceTemplate (pre-configured settings for fast client onboarding)
 *   - ClientPortalAccess (guest token for client view-only / approve portal)
 *   - AgencyOverview (aggregated stats for the agency dashboard)
 *
 * The agency's own workspace holds the AgencyProfile; clientWorkspaceIds is an
 * array of foreign workspace IDs (no FK constraint — clients are independent
 * workspaces that the agency happens to manage).
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── AgencyProfile ────────────────────────────────────────────────────────────

export interface AgencyProfileItem {
  id: string
  workspaceId: string
  isAgency: boolean
  clientWorkspaceIds: string[]
  brandName: string | null
  brandLogoUrl: string | null
  hideNashrinoBranding: boolean
  createdAt: Date
  updatedAt: Date
}

export interface UpdateAgencyProfileInput {
  brandName?: string | null
  brandLogoUrl?: string | null
  hideNashrinoBranding?: boolean
  clientWorkspaceIds?: string[]
}

// ── Client workspace summary ─────────────────────────────────────────────────
//
// Built by the repository's `listClientWorkspaces` — for each clientWorkspaceId
// in the agency profile, fetch the workspace row + counts (pending approvals,
// scheduled/published this month). No client secrets cross the boundary.

export interface ClientWorkspaceSummary {
  id: string
  name: string
  plan: string
  status: 'active' | 'expired' | 'error' | 'disconnected' | 'unknown'
  pendingApprovals: number
  usageStats: {
    postsThisMonth: number
    scheduledUpcoming: number
    platforms: number
  }
  category: string
  createdAt: Date
}

// ── Workspace templates ──────────────────────────────────────────────────────

export interface WorkspaceTemplateItem {
  id: string
  workspaceId: string
  name: string
  description: string | null
  template: WorkspaceTemplateConfig
  createdAt: Date
  updatedAt: Date
}

/**
 * Pre-configured settings applied when creating a new client workspace from a
 * template. Stored as JSON in the `template` column. Free-form keys so we can
 * extend without a migration; the service enforces structural shape only.
 */
export interface WorkspaceTemplateConfig {
  brandPrimaryColor?: string
  brandAccentColor?: string
  plan?: string
  channelTypes?: string[]
  defaultTags?: string[]
  approvalWorkflow?: boolean
  [key: string]: unknown
}

export interface CreateTemplateInput {
  name: string
  description?: string
  template: WorkspaceTemplateConfig
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>

// ── Client portal access ─────────────────────────────────────────────────────
//
// A ClientPortalAccess row stores a guest accessToken for a CLIENT workspace
 // (NOT the agency's workspace). The agency admin creates tokens for their
// clients so clients can log in via the public /api/agency/portal/[token]
// endpoint and view/approve their content.

export interface ClientPortalAccessItem {
  id: string
  workspaceId: string // client workspace ID
  accessToken: string
  permissions: string[] // e.g. ['content:view', 'content:approve']
  expiresAt: Date | null
  lastAccessedAt: Date | null
  isActive: boolean
  createdAt: Date
}

export interface CreatePortalAccessInput {
  workspaceId: string
  permissions: string[]
  expiresAt?: Date | null
}

/**
 * Public payload returned by /api/agency/portal/[token] — no agency-internal
 * fields, only what the client needs to render their portal view.
 */
export interface PublicPortalPayload {
  workspace: {
    id: string
    name: string
    brandPrimaryColor: string
    brandAccentColor: string
  }
  permissions: string[]
  // Recent content items the client can review/approve (limited by permissions).
  pendingContent: Array<{
    id: string
    title: string
    status: string
    scheduledAt: string | null
    authorName: string | null
    createdAt: string
  }>
}

// ── Agency overview (dashboard rollup) ───────────────────────────────────────

export interface AgencyOverview {
  totalClients: number
  pendingApprovals: number
  atRiskClients: number
  upcomingRenewals: number
  usageSummary: {
    postsThisMonth: number
    scheduledUpcoming: number
    totalPlatforms: number
  }
}
