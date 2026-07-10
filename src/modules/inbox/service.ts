import { decrypt } from '@/lib/crypto'
import { InboxRepository } from './repository'
import { InboxMessageNotFoundError, AssigneeMemberNotFoundError } from './errors'
import { sendCommentReply, sendPrivateReply, ProviderReplyError } from './instagram-reply'
import type {
  AuthContext,
  InboxListQuery,
  InboxListResult,
  InboxThreadDetail,
  InboxThreadListResult,
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
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null
    return { data: page, nextCursor }
  }

  async listThreads(auth: AuthContext, query: InboxListQuery): Promise<InboxThreadListResult> {
    const rows = await this.repo.listThreads(auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null
    return { data: page, nextCursor }
  }

  async getThread(auth: AuthContext, threadId: string): Promise<InboxThreadDetail> {
    const thread = await this.repo.getThread(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    return thread
  }

  async markRead(auth: AuthContext, messageId: string): Promise<{ ok: boolean }> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()
    await this.repo.markRead(messageId)
    return { ok: true }
  }

  async markUnread(auth: AuthContext, messageId: string): Promise<{ ok: boolean }> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()
    await this.repo.markUnread(messageId)
    return { ok: true }
  }

  async markThreadRead(auth: AuthContext, threadId: string): Promise<{ ok: boolean }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    await this.repo.markThreadRead(threadId, auth.workspaceId)
    return { ok: true }
  }

  async markThreadUnread(auth: AuthContext, threadId: string): Promise<{ ok: boolean }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    await this.repo.markThreadUnread(threadId, auth.workspaceId)
    return { ok: true }
  }

  async setThreadStatus(
    auth: AuthContext,
    threadId: string,
    status: string
  ): Promise<{ id: string; status: string }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    return this.repo.setThreadStatus(threadId, auth.workspaceId, status)
  }

  async assignMessage(
    auth: AuthContext,
    messageId: string,
    input: AssignInput
  ): Promise<{ ok: boolean; assigneeId: string | null }> {
    const message = await this.repo.findInWorkspace(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()

    if (input.assigneeId) {
      const member = await this.repo.findMemberInWorkspace(input.assigneeId, auth.workspaceId)
      if (!member) throw new AssigneeMemberNotFoundError()
    }

    const updated = await this.repo.assign(messageId, input.assigneeId)
    return { ok: true, assigneeId: updated.assigneeId }
  }

  async replyToMessage(
    auth: AuthContext,
    messageId: string,
    input: ReplyInput
  ): Promise<ReplyResult> {
    const message = await this.repo.findWithPlatform(messageId, auth.workspaceId)
    if (!message) throw new InboxMessageNotFoundError()

    // Send to the real commenter first — only persist the reply locally once
    // the provider accepted it. Demo/seed rows (no externalId) and platforms
    // without a token stay local-only, so the demo workspace keeps working.
    const { platform } = message
    if (message.externalId && platform?.type === 'instagram' && platform.tokenSecret) {
      const accessToken = decrypt(platform.tokenSecret)
      if (message.messageType === 'dm') {
        if (!platform.targetId) {
          throw new ProviderReplyError(
            'شناسه حساب اینستاگرام تنظیم نشده است — کانال را دوباره متصل کنید'
          )
        }
        await sendPrivateReply(accessToken, platform.targetId, message.externalId, input.reply)
      } else {
        await sendCommentReply(accessToken, message.externalId, input.reply)
      }
    }

    const updated = await this.repo.reply(messageId, input.reply)
    return { ok: true, reply: updated.reply, isReplied: updated.isReplied }
  }

  async replyToThread(
    auth: AuthContext,
    threadId: string,
    input: ReplyInput
  ): Promise<ReplyResult> {
    const thread = await this.repo.findThreadWithPlatform(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()

    const inbound = thread.messages[0]
    if (!inbound) throw new ProviderReplyError('No inbound message is available for this thread')

    const { platform } = thread
    if (platform?.type === 'instagram' && platform.tokenSecret) {
      const accessToken = decrypt(platform.tokenSecret)
      if (inbound.messageType === 'dm') {
        if (!platform.targetId) {
          throw new ProviderReplyError(
            'شناسه حساب اینستاگرام تنظیم نشده است — کانال را دوباره متصل کنید'
          )
        }
        await sendPrivateReply(
          accessToken,
          platform.targetId,
          inbound.providerMessageId,
          input.reply
        )
      } else {
        await sendCommentReply(accessToken, inbound.providerMessageId, input.reply)
      }
    }

    const outbound = await this.repo.appendThreadReply(
      thread.id,
      auth.workspaceId,
      platform.id,
      inbound.messageType,
      input.reply
    )
    await this.repo.markLegacyRepliedByExternalId(
      auth.workspaceId,
      platform.id,
      inbound.providerMessageId,
      input.reply
    )

    return {
      ok: true,
      reply: input.reply.trim(),
      isReplied: true,
      threadMessageId: outbound.id,
    }
  }
}

export const inboxService = new InboxService()
