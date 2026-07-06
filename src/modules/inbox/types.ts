export interface AuthContext { workspaceId: string; userId: string }

export interface InboxListQuery { cursor?: string; limit: number }

export interface InboxMessage {
  id: string
  senderName: string | null
  senderAvatar: string | null
  message: string | null
  isRead: boolean
  isReplied: boolean
  reply: string | null
  platform: string
  platformName: string
  messageType: string | null
  assigneeId: string | null
  status: string
  slaStartedAt: Date | null
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
}

export interface InboxListResult {
  data: InboxMessage[]
  nextCursor: string | null
}

export interface AssignInput { assigneeId: string | null }
export interface ReplyInput { reply: string }

export interface ReplyResult { ok: boolean; reply: string | null; isReplied: boolean }
