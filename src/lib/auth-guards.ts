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
}

export type WorkspaceGuardError = {
  error: NextResponse
  workspace: null
  session: Awaited<ReturnType<typeof getServerSession>>
}

export type WorkspaceGuardResult = WorkspaceGuardSuccess | WorkspaceGuardError

export async function requireWorkspaceApi(): Promise<WorkspaceGuardResult> {
  const session = await getServerSession(authOptions)

  // No session — try dev bypass, otherwise 401
  if (!session?.user) {
    // Dev-only: fall back to first workspace (demo mode for Z.ai preview)
    if (process.env.NODE_ENV !== 'production') {
      const ws = await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
      if (ws) {
        return {
          error: null,
          workspace: ws,
          session: null,
          role: 'admin' as Role, // dev mode = full access
        }
      }
    }
    return {
      error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
      workspace: null,
      session: null,
    }
  }

  const wsId = (session as any).activeWorkspaceId
  if (!wsId) {
    return {
      error: NextResponse.json({ error: 'no_workspace' }, { status: 403 }),
      workspace: null,
      session,
    }
  }

  const membership = await db.workspaceMember.findFirst({
    where: {
      userId: (session.user as any).id,
      workspaceId: wsId,
    },
    include: { workspace: true },
  })

  if (!membership) {
    return {
      error: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
      workspace: null,
      session,
    }
  }

  return {
    error: null,
    workspace: membership.workspace,
    session,
    role: membership.role as Role,
  }
}

/**
 * Check if a role has a specific permission.
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
  | 'inbox.reply'
  | 'member.invite'
  | 'billing.manage'

const MATRIX: Record<Permission, Role[]> = {
  'content.create': ['admin', 'editor'],
  'content.edit': ['admin', 'editor'],
  'content.delete': ['admin'],
  'content.review': ['admin', 'approver'],
  'content.publish': ['admin', 'editor'],
  'job.schedule': ['admin', 'editor'],
  'job.cancel': ['admin', 'editor'],
  'platform.manage': ['admin', 'editor'],
  'inbox.reply': ['admin', 'editor'],
  'member.invite': ['admin'],
  'billing.manage': ['admin'],
}

export function can(role: Role, action: Permission): boolean {
  return MATRIX[action]?.includes(role) ?? false
}
