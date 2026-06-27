import { db } from './db'

export async function writeAuditLog(entry: {
  action: string
  workspaceId: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        workspaceId: entry.workspaceId,
        metadata: entry.metadata ?? {},
      },
    })
  } catch (err) {
    console.error('[audit] failed to write audit log:', err)
  }
}
