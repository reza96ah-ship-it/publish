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
}
