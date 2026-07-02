import { InboxRepository } from './repository'
import { InboxMessageNotFoundError, AssigneeMemberNotFoundError } from './errors'
import type {
  AuthContext,
  InboxListQuery,
  InboxListResult,
  AssignInput,
  ReplyInput,
  ReplyResult,
} from './types'

export class InboxService {
  constructor(private readonly repo: InboxRepository = new InboxRepository()) {}

  async listMessages(auth: AuthContext, query: InboxListQuery): Promise<InboxListResult> {
    const rows = await this.repo.list(auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  async markRead(auth: AuthContext, messageId: string): Promise<{ ok: boolean }> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()
    await this.repo.markRead(messageId)
    return { ok: true }
  }

  async assignMessage(auth: AuthContext, messageId: string, input: AssignInput): Promise<{ ok: boolean; assigneeId: string | null }> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()

    if (input.assigneeId) {
      const member = await this.repo.findMemberInWorkspace(input.assigneeId, auth.workspaceId)
      if (!member) throw new AssigneeMemberNotFoundError()
    }

    const updated = await this.repo.assign(messageId, input.assigneeId)
    return { ok: true, assigneeId: updated.assigneeId }
  }

  async replyToMessage(auth: AuthContext, messageId: string, input: ReplyInput): Promise<ReplyResult> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()

    const updated = await this.repo.reply(messageId, input.reply)
    return { ok: true, reply: updated.reply, isReplied: updated.isReplied }
  }
}

export const inboxService = new InboxService()
