import { db } from './db'
import { getServerSession } from 'next-auth'
import { authOptions } from './auth'

/**
 * Get the active workspace for the current user.
 *
 * If the user is authenticated, uses their activeWorkspaceId from the session.
 * If not authenticated (demo mode), falls back to the first workspace.
 *
 * This is the bridge between the old single-tenant demo and the new
 * multi-tenant auth system. API routes can be migrated gradually to use
 * requireWorkspace() from auth-guards.ts.
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
    // No session or DB error — fall through to demo mode
  }

  // Demo mode: return first workspace
  const ws = await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
  return ws
}

export async function getWorkspaceId() {
  const ws = await getWorkspace()
  return ws?.id
}

/**
 * Get the current user ID (or null in demo mode).
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
