import { db } from '@/lib/db'
import type { NotificationListQuery, NotificationItem } from './types'

export class NotificationsRepository {
  async list(workspaceId: string, query: NotificationListQuery): Promise<NotificationItem[]> {
    const rows = await db.notification.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    })
    return rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }))
  }

  /**
   * Bulk-mark every unread notification in the workspace as read (P1-21).
   * The Notification model is workspace-scoped (no userId column), so this
   * marks all unread rows for the workspace. Returns the number of rows updated.
   */
  async markAllRead(workspaceId: string): Promise<number> {
    const result = await db.notification.updateMany({
      where: { workspaceId, isRead: false },
      data: { isRead: true },
    })
    return result.count
  }
}
