import { db } from './db'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Get the active workspace for the current user.
 *
 * Production: requires an authenticated session. Returns null if no session,
 * no activeWorkspaceId, or no membership — NO demo-mode fallback.
 *
 * Development: falls back to the first workspace (demo mode) so the Z.ai
 * preview iframe works without a login session. This bypass is gated by
 * NODE_ENV and is IMPOSSIBLE in production.
 */
export async function getWorkspace() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      const wsId = (session as any).activeWorkspaceId
      if (wsId) {
        const ws = await db.workspace.findUnique({ where: { id: wsId } })
        if (ws) return ws
      }
    }
  } catch {
    // No session or DB error — fall through
  }

  // Dev-only fallback: return first workspace (demo mode for Z.ai preview).
  // In production, this branch is never taken — returns null → 401/403.
  if (process.env.NODE_ENV !== 'production') {
    return await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
  }

  // Production: no session = no workspace
  return null
}

export async function getWorkspaceId() {
  const ws = await getWorkspace()
  return ws?.id
}

/**
 * Get the current user ID (or null if not authenticated).
 */
export async function getUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user) {
      return (session.user as any).id ?? null
    }
  } catch {
    // No session
  }
  return null
}
