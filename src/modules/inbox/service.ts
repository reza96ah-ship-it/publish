import { decrypt } from '@/lib/crypto'
import { InboxRepository } from './repository'
import { InboxMessageNotFoundError, AssigneeMemberNotFoundError } from './errors'
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
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null
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
      const error = new Error('Thread is already claimed by another agent')
      error.name = 'InboxThreadClaimConflictError'
      throw error
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
      // Enforce the Meta 24h DM messaging window server-side — the Graph API
      // would reject the send anyway; failing here gives the agent an
      // actionable Persian message instead of a raw provider error. Public
      // comment replies (the non-dm path below) have no window, so only DM
      // threads are gated. The 7d limit applies to *private* replies to
      // comments (comment→DM automation), not to public replies.
      if (inbound.messageType === 'dm') {
        const windowExpiresAt = getReplyWindowExpiry('dm', thread.lastInboundAt)
        if (windowExpiresAt && windowExpiresAt.getTime() < Date.now()) {
          throw new ProviderReplyError(
            'پنجره ۲۴ ساعته پاسخ دایرکت به پایان رسیده است — طبق سیاست متا امکان ارسال نیست'
          )
        }
      }
      const accessToken = decrypt(platform.tokenSecret)
      if (inbound.messageType === 'dm') {
        if (!platform.targetId) {
          throw new ProviderReplyError(
            'شناسه حساب اینستاگرام تنظیم نشده است — کانال را دوباره متصل کنید'
          )
        }
        // DM threads must be addressed by the sender's Instagram-scoped ID
        // (IGSID) — recipient.comment_id is only valid for comment private
        // replies, and a DM message id there is rejected by the Graph API.
        const recipientIgsid = inbound.senderExternalId ?? thread.providerUserId
        if (!recipientIgsid) {
          throw new ProviderReplyError(
            'شناسه فرستنده این گفتگو در دسترس نیست — پاسخ از اینستاگرام ممکن نیست'
          )
        }
        await sendDirectMessage(accessToken, platform.targetId, recipientIgsid, input.reply)
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
