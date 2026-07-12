import { decrypt } from '@/lib/crypto'
import {
  encodeThreadCursor,
  encodeThreadMessageCursor,
  InboxRepository,
} from './repository'
import {
  InboxMessageNotFoundError,
  AssigneeMemberNotFoundError,
  InboxThreadClaimConflictError,
} from './errors'
import {
  sendCommentReply,
  sendPrivateReply,
  sendDirectMessage,
  ProviderReplyError,
} from './instagram-reply'
import { emitInboxThreadEvent } from './realtime-emit'
import { getReplyWindowExpiry } from '../../../shared/instagram-graph'
import type {
  AuthContext,
  InboxListQuery,
  InboxListResult,
  InboxThreadDetail,
  InboxThreadMessageListResult,
  InboxThreadListResult,
  InboxThreadListQuery,
  InboxThreadQueueCounts,
  AssignInput,
  ThreadPriorityInput,
  ThreadTagsInput,
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

  async listThreads(auth: AuthContext, query: InboxThreadListQuery): Promise<InboxThreadListResult> {
    // 'mine' filters by WorkspaceMember id — resolve it once per request.
    const membershipId =
      query.queue === 'mine'
        ? ((await this.repo.findMemberByUserInWorkspace(auth.userId, auth.workspaceId))?.id ?? null)
        : null
    const rows = await this.repo.listThreads(auth.workspaceId, query, membershipId)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const cursorThread = page[page.length - 1]
    const nextCursor = hasMore && cursorThread ? encodeThreadCursor(cursorThread) : null
    return { data: page, nextCursor }
  }

  /** Queue counts + the caller's membership id (for presence self-filtering). */
  async threadQueueCounts(
    auth: AuthContext
  ): Promise<{ counts: InboxThreadQueueCounts; membershipId: string | null }> {
    const member = await this.repo.findMemberByUserInWorkspace(auth.userId, auth.workspaceId)
    const counts = await this.repo.threadQueueCounts(auth.workspaceId, member?.id ?? null)
    return { counts, membershipId: member?.id ?? null }
  }

  async getThread(auth: AuthContext, threadId: string): Promise<InboxThreadDetail> {
    const thread = await this.repo.getThread(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    return thread
  }

  async listThreadMessages(
    auth: AuthContext,
    threadId: string,
    query: InboxListQuery
  ): Promise<InboxThreadMessageListResult> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    const rows = await this.repo.listThreadMessages(threadId, auth.workspaceId, query)
    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const cursorMessage = page[page.length - 1]
    const nextCursor =
      hasMore && cursorMessage ? encodeThreadMessageCursor(cursorMessage) : null
    return { data: [...page].reverse(), nextCursor }
  }

  /** Customer context panel: sender history across the workspace. */
  async getThreadCustomerContext(auth: AuthContext, threadId: string) {
    const context = await this.repo.getThreadCustomerContext(threadId, auth.workspaceId)
    if (!context) throw new InboxMessageNotFoundError()
    return context
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

  async assignThread(
    auth: AuthContext,
    threadId: string,
    input: AssignInput
  ): Promise<{ ok: boolean; assigneeId: string | null }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()

    if (input.assigneeId) {
      const member = await this.repo.findMemberInWorkspace(input.assigneeId, auth.workspaceId)
      if (!member) throw new AssigneeMemberNotFoundError()
    }

    const updated = await this.repo.assignThread(threadId, auth.workspaceId, input.assigneeId)
    return { ok: true, assigneeId: updated.assigneeId }
  }

  async claimThread(
    auth: AuthContext,
    threadId: string
  ): Promise<{ ok: boolean; assigneeId: string; lockExpiresAt: Date }> {
    const member = await this.repo.findMemberByUserInWorkspace(auth.userId, auth.workspaceId)
    if (!member) throw new AssigneeMemberNotFoundError()

    const claimed = await this.repo.claimThread(threadId, auth.workspaceId, member.id)
    if (!claimed) {
      const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
      if (!thread) throw new InboxMessageNotFoundError()
      throw new InboxThreadClaimConflictError()
    }

    // Presence: teammates' open inboxes show "X در حال پاسخ" immediately.
    void emitInboxThreadEvent(auth.workspaceId, {
      threadId,
      kind: 'updated',
      messageType: 'presence',
    })

    return claimed
  }

  async updateThreadTags(
    auth: AuthContext,
    threadId: string,
    input: ThreadTagsInput
  ): Promise<{ id: string; tags: string[] }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    return this.repo.updateThreadTags(threadId, input.tags)
  }

  async updateThreadPriority(
    auth: AuthContext,
    threadId: string,
    input: ThreadPriorityInput
  ): Promise<{ id: string; priority: string }> {
    const thread = await this.repo.findThreadInWorkspace(threadId, auth.workspaceId)
    if (!thread) throw new InboxMessageNotFoundError()
    return this.repo.updateThreadPriority(threadId, input.priority)
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
    if (message.externalId && platform?.type === 'instagram') {
      if (!platform.tokenSecret) {
        throw new ProviderReplyError(
          'اتصال اینستاگرام معتبر نیست — کانال را دوباره متصل کنید و سپس پاسخ را ارسال کنید'
        )
      }
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
    if (platform?.type !== 'instagram') {
      throw new ProviderReplyError('ارسال پاسخ برای این کانال پشتیبانی نمی‌شود')
    }
    if (!platform.tokenSecret) {
      throw new ProviderReplyError(
        'اتصال اینستاگرام معتبر نیست — کانال را دوباره متصل کنید و سپس پاسخ را ارسال کنید'
      )
    }

    if (inbound.messageType === 'dm') {
      const windowExpiresAt = getReplyWindowExpiry('dm', thread.lastInboundAt)
      if (windowExpiresAt && windowExpiresAt.getTime() < Date.now()) {
        throw new ProviderReplyError(
          'پنجره ۲۴ ساعته پاسخ دایرکت به پایان رسیده است — طبق سیاست متا امکان ارسال نیست'
        )
      }
      if (!platform.targetId) {
        throw new ProviderReplyError(
          'شناسه حساب اینستاگرام تنظیم نشده است — کانال را دوباره متصل کنید'
        )
      }
    }

    const member = await this.repo.findMemberByUserInWorkspace(auth.userId, auth.workspaceId)
    if (!member) throw new AssigneeMemberNotFoundError()
    const claim = await this.repo.claimThread(threadId, auth.workspaceId, member.id)
    if (!claim) throw new InboxThreadClaimConflictError()

    void emitInboxThreadEvent(auth.workspaceId, {
      threadId,
      kind: 'updated',
      messageType: 'presence',
    })

    const accessToken = decrypt(platform.tokenSecret)
    let providerMessageId: string | null = null
    if (inbound.messageType === 'dm') {
      if (!platform.targetId) {
        throw new ProviderReplyError(
          'شناسه حساب اینستاگرام تنظیم نشده است — کانال را دوباره متصل کنید'
        )
      }
      const recipientIgsid = inbound.senderExternalId ?? thread.providerUserId
      if (!recipientIgsid) {
        throw new ProviderReplyError(
          'شناسه فرستنده این گفتگو در دسترس نیست — پاسخ از اینستاگرام ممکن نیست'
        )
      }
      const receipt = await sendDirectMessage(
        accessToken,
        platform.targetId,
        recipientIgsid,
        input.reply
      )
      providerMessageId = receipt?.providerMessageId ?? null
    } else {
      const receipt = await sendCommentReply(accessToken, inbound.providerMessageId, input.reply)
      providerMessageId = receipt?.providerMessageId ?? null
    }

    const outbound = await this.repo.appendThreadReply(
      thread.id,
      auth.workspaceId,
      platform.id,
      inbound.messageType,
      input.reply,
      providerMessageId
    )
    await this.repo.markLegacyRepliedByExternalId(
      auth.workspaceId,
      platform.id,
      inbound.providerMessageId,
      input.reply
    )

    // Let other open inboxes (teammates) see the reply land live.
    void emitInboxThreadEvent(auth.workspaceId, {
      threadId: thread.id,
      kind: 'updated',
      messageType: inbound.messageType,
      preview: input.reply.slice(0, 120),
    })

    return {
      ok: true,
      reply: input.reply.trim(),
      isReplied: true,
      threadMessageId: outbound.id,
    }
  }
}

export const inboxService = new InboxService()
