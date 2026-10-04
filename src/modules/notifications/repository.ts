import { db } from '@/lib/db'
import type { NotificationListQuery, NotificationItem } from './types'

export class NotificationsRepository {
  async list(workspaceId: string, userId: string, query: NotificationListQuery): Promise<NotificationItem[]> {
    const rows = await db.notification.findMany({
      where: {
        workspaceId,
        OR: [
          { recipientMemberId: null },
          { recipientMember: { is: { workspaceId, userId } } },
        ],
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
      href: n.href,
      isRead: n.isRead,
      createdAt: n.createdAt,
    }))
  }

  /**
   * Mark only workspace-wide and this member's notifications as read.
   * Other members' private Inbox reminders must stay untouched.
   */
  async markAllRead(workspaceId: string, userId: string): Promise<number> {
    const result = await db.notification.updateMany({
      where: {
        workspaceId, isRead: false,
        OR: [
          { recipientMemberId: null },
          { recipientMember: { is: { workspaceId, userId } } },
        ],
      },
      data: { isRead: true },
    })
    return result.count
  }

  async markRead(workspaceId: string, userId: string, id: string): Promise<boolean> {
    const result = await db.notification.updateMany({
      where: {
        id, workspaceId, isRead: false,
        OR: [
          { recipientMemberId: null },
          { recipientMember: { is: { workspaceId, userId } } },
        ],
      },
      data: { isRead: true },
    })
    return result.count > 0
  }
}
