import { NotificationsRepository } from './repository'
import type { AuthContext, NotificationListQuery, NotificationListResult } from './types'

export class NotificationsService {
  constructor(private readonly repo: NotificationsRepository = new NotificationsRepository()) {}

  async listNotifications(auth: AuthContext, query: NotificationListQuery): Promise<NotificationListResult> {
    const rows = await this.repo.list(auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }
}

export const notificationsService = new NotificationsService()
