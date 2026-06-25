import { db } from './db'

// Single-tenant demo: resolve the active workspace.
export async function getWorkspace() {
  const ws = await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
  return ws
}

export async function getWorkspaceId() {
  const ws = await getWorkspace()
  return ws?.id
}
