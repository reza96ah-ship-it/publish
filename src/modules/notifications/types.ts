export interface AuthContext { workspaceId: string; userId: string }

export interface NotificationListQuery { cursor?: string; limit: number }

export interface NotificationItem {
  id: string
  type: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: Date
}

export interface NotificationListResult {
  data: NotificationItem[]
  nextCursor: string | null
}
