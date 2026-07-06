/**
 * Audit log writer for API routes.
 * Writes to the AuditLog table for sensitive actions.
 */

import { db } from './db'
import { logger } from './logger'

export async function writeAuditLog(entry: {
  action: string
  workspaceId: string
  userId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: entry.action,
        workspaceId: entry.workspaceId,
        userId: entry.userId || null,
        metadata: JSON.stringify(entry.metadata || {}),
      },
    })
  } catch (err) {
    logger.error({ msg: 'audit log write failed', error: err, action: entry.action })
  }
}
