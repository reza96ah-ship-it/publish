export interface AuthContext {
  workspaceId: string
  userId: string
}

export interface InboxListQuery {
  cursor?: string
  limit: number
}

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

export interface InboxThreadSummary {
  id: string
  providerThreadId: string
  providerUserId: string | null
  title: string
  platform: string
  platformName: string
  messageType: string
  status: string
  assigneeId: string | null
  assigneeName: string | null
  assigneeAvatar: string | null
  priority: string
  tags: string[]
  lockedById: string | null
  lockedByName: string | null
  lockExpiresAt: Date | null
  unreadCount: number
  lastMessageAt: Date
  slaStartedAt: Date
  firstResponseAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lastMessage: InboxThreadMessage | null
}

export interface InboxThreadAttachment {
  type: string
  title: string
  url: string | null
  providerId: string | null
}

export interface InboxThreadMessage {
  id: string
  providerMessageId: string
  direction: string
  messageType: string
  senderExternalId: string | null
  senderName: string
  body: string
  attachments: InboxThreadAttachment[]
  createdAt: Date
}

export interface InboxThreadDetail extends InboxThreadSummary {
  messages: InboxThreadMessage[]
}

export interface InboxThreadListResult {
  data: InboxThreadSummary[]
  nextCursor: string | null
}

export interface AssignInput {
  assigneeId: string | null
}
export interface ThreadTagsInput {
  tags: string[]
}
export interface ThreadPriorityInput {
  priority: string
}
export interface ReplyInput {
  reply: string
}

export interface ReplyResult {
  ok: boolean
  reply: string | null
  isReplied: boolean
  threadMessageId?: string
}
