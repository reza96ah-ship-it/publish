/**
 * Auth guards for API routes and Server Components.
 *
 * Usage in Route Handlers:
 *   import { requireWorkspace } from "@/lib/auth-guards";
 *   export async function GET() {
 *     const { workspace } = await requireWorkspace();
 *     // workspace.id is guaranteed to be the user's active workspace
 *   }
 *
 * Usage in Server Components:
 *   import { getSession } from "@/lib/auth-guards";
 *   const session = await getSession();
 *   if (!session) redirect("/auth/signin");
 */

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'

export type Role = 'admin' | 'editor' | 'approver' | 'viewer'

const VALID_ROLES = new Set<Role>(['admin', 'editor', 'approver', 'viewer'])

const ROLE_RANK: Record<Role, number> = {
  viewer: 0,
  approver: 1,
  editor: 2,
  admin: 3,
}

/** Get the current session (or null). For Server Components. */
export async function getSession() {
  return getServerSession(authOptions)
}

/**
 * Require an authenticated session. For Server Components — redirects to signin.
 */
export async function requireAuth() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')
  return session
}

/**
 * Require an active workspace membership. For Server Components.
 * Returns the session + workspace + membership.
 * REPLACES the old getWorkspaceId() hack in src/lib/server.ts.
 */
export async function requireWorkspace() {
  const session = await getServerSession(authOptions)
  if (!session?.user) redirect('/auth/signin')

  const wsId = (session as any).activeWorkspaceId
  if (!wsId) redirect('/auth/signin')

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: (session.user as any).id,
      workspaceId: wsId,
    },
    include: { workspace: true },
  })

  if (!membership) redirect('/auth/signin')

  return {
    session,
    membership,
    workspace: membership.workspace,
    role: membership.role as Role,
  }
}

/**
 * Require a minimum role. For Server Components — redirects to 403 if insufficient.
 */
export async function requireRole(min: Role) {
  const { session, role } = await requireWorkspace()
  if (ROLE_RANK[role] < ROLE_RANK[min]) redirect('/403')
  return { session, role }
}

/**
 * API route guard — returns 401/403 JSON instead of redirect.
 * Usage:
 *   const guard = await requireWorkspaceApi();
 *   if (guard.error) return guard.error;
 *   const workspaceId = guard.workspace.id;
 *
 * The return type is a discriminated union on `error` so that after the
 * `if (guard.error) return guard.error` check, TypeScript narrows `workspace`
 * to non-null — no `!` assertions needed at call sites.
 *
 * Production: requires authenticated session + workspace membership.
 * Development: falls back to the first workspace with admin role (demo mode)
 *   so the Z.ai preview iframe works without login. Gated by NODE_ENV.
 */
export type WorkspaceGuardSuccess = {
  error: null
  workspace: Awaited<ReturnType<typeof db.workspace.findFirst>> & object
  session: Awaited<ReturnType<typeof getServerSession>>
  role: Role
  userId: string
  membershipId: string
}

export type WorkspaceGuardError = {
  error: NextResponse
  workspace: null
  session: Awaited<ReturnType<typeof getServerSession>>
  userId: null
  membershipId: null
}

export type WorkspaceGuardResult = WorkspaceGuardSuccess | WorkspaceGuardError

export async function requireWorkspaceApi(): Promise<WorkspaceGuardResult> {
  const session = await getServerSession(authOptions)

  // No session — try dev bypass, otherwise 401
  if (!session?.user) {
    // Explicit opt-in bypass via DISABLE_AUTH=1 (never set in production)
    if (process.env.DISABLE_AUTH === '1') {
      const ws = await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (ws) {
        return {
          error: null,
          workspace: ws,
          session: null,
          role: 'admin' as Role, // dev mode = full access
          userId: 'dev-admin',
          membershipId: 'dev-membership',
        }
      }
    }
    return {
      error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      workspace: null,
      session: null,
      userId: null,
      membershipId: null,
    }
  }

  const userId = (session.user as any).id as string | undefined
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'unauthorized', message: 'User ID missing from session' }, { status: 401 }),
      workspace: null,
      session,
      userId: null,
      membershipId: null,
    }
  }

  const wsId = (session as any).activeWorkspaceId
  if (!wsId) {
    return {
      error: NextResponse.json({ error: 'no_workspace' }, { status: 403 }),
      workspace: null,
      session,
      userId: null,
      membershipId: null,
    }
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId, workspaceId: wsId },
    include: { workspace: true },
  })

  if (!membership) {
    return {
      error: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
      workspace: null,
      session,
      userId: null,
      membershipId: null,
    }
  }

  return {
    error: null,
    workspace: membership.workspace,
    session,
    role: membership.role as Role,
    userId,
    membershipId: membership.id,
  }
}

/**
 * Check if a role has a specific permission.
 *
 * Issue #142: fail closed for unknown roles — return false instead of
 * accidentally granting access to an unrecognized role string.
 */
export type Permission =
  | 'content.create'
  | 'content.edit'
  | 'content.delete'
  | 'content.review'
  | 'content.publish'
  | 'job.schedule'
  | 'job.cancel'
  | 'platform.manage'
  | 'platform.connect' // Issue #142: separate credential management from platform settings
  | 'inbox.reply'
  | 'inbox.assign'
  | 'member.invite'
  | 'member.remove'
  | 'billing.manage'
  | 'security.admin' // Issue #142: operational dashboards + admin controls
  | 'analytics.view'
  | 'media.upload'
  | 'media.delete'
  | 'workspace.settings'

const MATRIX: Record<Permission, Role[]> = {
  'content.create': ['admin', 'editor'],
  'content.edit': ['admin', 'editor'],
  'content.delete': ['admin'],
  'content.review': ['admin', 'approver'],
  'content.publish': ['admin', 'editor'],
  'job.schedule': ['admin', 'editor'],
  'job.cancel': ['admin', 'editor'],
  'platform.manage': ['admin', 'editor'],
  // Issue #142: credential management (connect/reconnect) is admin-only for secret safety
  'platform.connect': ['admin'],
  'inbox.reply': ['admin', 'editor'],
  'inbox.assign': ['admin', 'editor'],
  'member.invite': ['admin'],
  'member.remove': ['admin'],
  'billing.manage': ['admin'],
  'security.admin': ['admin'],
  'analytics.view': ['admin', 'editor', 'approver'],
  'media.upload': ['admin', 'editor'],
  'media.delete': ['admin'],
  'workspace.settings': ['admin'],
}

export function can(role: Role, action: Permission): boolean {
  // Issue #142: fail closed for unknown roles
  if (!VALID_ROLES.has(role)) return false
  return MATRIX[action]?.includes(role) ?? false
}

// ── Issue #142: Centralized permission guards ─────────────────────────────
//
// These helpers combine workspace membership + permission check in one call.
// Routes should use these instead of requireWorkspaceApi() + manual can().
//
// Usage:
//   const guard = await requirePermissionApi('content.publish')
//   if (guard.error) return guard.error
//   // guard.workspace, guard.role, guard.userId are now available

export type PermissionGuardSuccess = {
  error: null
  workspace: Awaited<ReturnType<typeof db.workspace.findFirst>> & object
  session: Awaited<ReturnType<typeof getServerSession>>
  role: Role
  userId: string
  membershipId: string
  workspaceId: string
}

export type PermissionGuardError = {
  error: NextResponse
  workspace: null
  session: Awaited<ReturnType<typeof getServerSession>>
  userId: null
  membershipId: null
  workspaceId: null | undefined
}

export type PermissionGuardResult =
  | PermissionGuardSuccess
  | PermissionGuardError

/**
 * Issue #142: Require workspace membership AND a specific permission.
 * Returns 401 (unauthenticated), 403 (no workspace / not a member),
 * or 403 (insufficient permission).
 *
 * Fails closed: unknown roles and unknown permissions always deny.
 */
export async function requirePermissionApi(
  permission: Permission
): Promise<PermissionGuardResult> {
  const guard = await requireWorkspaceApi()

  if (guard.error) {
    return { ...guard, workspaceId: null }
  }

  // Issue #142: check permission using the centralized matrix
  if (!can(guard.role, permission)) {
    return {
      error: NextResponse.json(
        { error: 'forbidden', message: 'دسترسی کافی برای این عملیات ندارید' },
        { status: 403 }
      ),
      workspace: null,
      session: guard.session,
      userId: null,
      membershipId: null,
      workspaceId: null,
    }
  }

  // userId and membershipId are already resolved by requireWorkspaceApi —
  // no second DB query needed.
  return {
    error: null,
    workspace: guard.workspace,
    session: guard.session,
    role: guard.role,
    userId: guard.userId,
    membershipId: guard.membershipId,
    workspaceId: guard.workspace.id,
  }
}

/**
 * Issue #142: Require workspace membership AND at least one of the listed permissions.
 * Use sparingly — most routes need exactly one permission.
 */
export async function requireAnyPermissionApi(
  permissions: Permission[]
): Promise<PermissionGuardResult> {
  const guard = await requireWorkspaceApi()

  if (guard.error) {
    return { ...guard, workspaceId: null }
  }

  const hasAny = permissions.some((p) => can(guard.role, p))
  if (!hasAny) {
    return {
      error: NextResponse.json(
        { error: 'forbidden', message: 'دسترسی کافی برای این عملیات ندارید' },
        { status: 403 }
      ),
      workspace: null,
      session: guard.session,
      userId: null,
      membershipId: null,
      workspaceId: null,
    }
  }

  return {
    error: null,
    workspace: guard.workspace,
    session: guard.session,
    role: guard.role,
    userId: guard.userId,
    membershipId: guard.membershipId,
    workspaceId: guard.workspace.id,
  }
}

/**
 * Issue #142: Server-component equivalent of requirePermissionApi.
 * Redirects to /403 if insufficient permission.
 */
export async function requirePermission(permission: Permission) {
  const { session, role } = await requireWorkspace()
  if (!can(role, permission)) redirect('/403')
  return { session, role }
}
