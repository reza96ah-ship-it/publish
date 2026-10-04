import { describe, it, expect, beforeEach, vi } from 'vitest'

const { igMock, zernioMock, attemptMock } = vi.hoisted(() => ({
  igMock: {
    sendCommentReply: vi.fn(),
    sendPrivateReply: vi.fn(),
    sendDirectMessage: vi.fn(),
  },
  zernioMock: {
    getZernioInboxConversation: vi.fn(),
    sendZernioInboxMessage: vi.fn(),
    sendZernioCommentReply: vi.fn(),
  },
  attemptMock: {
    beginZernioReplyAttempt: vi.fn(),
    completeZernioReplyAttempt: vi.fn(),
    markZernioReplyAttempt: vi.fn(),
  },
}))

vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v: string) => `dec:${v}`) }))
vi.mock('@/modules/inbox/instagram-reply', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/inbox/instagram-reply')>()
  return {
    ProviderReplyError: actual.ProviderReplyError,
    sendCommentReply: igMock.sendCommentReply,
    sendPrivateReply: igMock.sendPrivateReply,
    sendDirectMessage: igMock.sendDirectMessage,
  }
})
vi.mock('@/modules/inbox/realtime-emit', () => ({
  emitInboxThreadEvent: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/zernio', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/zernio')>()),
  ...zernioMock,
}))
vi.mock('@/modules/inbox/zernio-reply-attempt', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/modules/inbox/zernio-reply-attempt')>()),
  ...attemptMock,
}))

import { InboxService } from '@/modules/inbox/service'
import type { InboxRepository } from '@/modules/inbox/repository'

const AUTH = { workspaceId: 'ws_1', userId: 'user_1' }

function makeRepo(message: Record<string, unknown> | null) {
  return {
    findWithPlatform: vi.fn().mockResolvedValue(message),
    reply: vi.fn().mockResolvedValue({ reply: 'پاسخ', isReplied: true }),
  } as unknown as InboxRepository
}

const igPlatform = { type: 'instagram', tokenSecret: 'enc_token', targetId: 'ig_user_1' }

describe('inboxService.replyToMessage — real Instagram sends', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    igMock.sendCommentReply.mockResolvedValue({ providerMessageId: 'provider-comment-reply' })
    igMock.sendPrivateReply.mockResolvedValue({ providerMessageId: 'provider-private-reply' })
    igMock.sendDirectMessage.mockResolvedValue({ providerMessageId: 'provider-dm-reply' })
  })

  it('sends a public comment reply via the Graph API before persisting', async () => {
    const repo = makeRepo({
      id: 'msg_1',
      externalId: 'cmt_1',
      messageType: 'comment',
      platform: igPlatform,
    })
    const service = new InboxService(repo)

    const result = await service.replyToMessage(AUTH, 'msg_1', { reply: 'پاسخ' })

    expect(igMock.sendCommentReply).toHaveBeenCalledWith('dec:enc_token', 'cmt_1', 'پاسخ')
    expect(igMock.sendPrivateReply).not.toHaveBeenCalled()
    expect(repo.reply).toHaveBeenCalledWith('msg_1', 'پاسخ')
    expect(result.ok).toBe(true)
  })

  it('sends a private reply for dm-type messages', async () => {
    const repo = makeRepo({
      id: 'msg_2',
      externalId: 'cmt_2',
      messageType: 'dm',
      platform: igPlatform,
    })
    const service = new InboxService(repo)

    await service.replyToMessage(AUTH, 'msg_2', { reply: 'پاسخ خصوصی' })

    expect(igMock.sendPrivateReply).toHaveBeenCalledWith(
      'dec:enc_token',
      'ig_user_1',
      'cmt_2',
      'پاسخ خصوصی'
    )
    expect(igMock.sendCommentReply).not.toHaveBeenCalled()
  })

  it('stays local-only for seed/demo rows without externalId', async () => {
    const repo = makeRepo({
      id: 'msg_3',
      externalId: null,
      messageType: 'comment',
      platform: igPlatform,
    })
    const service = new InboxService(repo)

    const result = await service.replyToMessage(AUTH, 'msg_3', { reply: 'پاسخ' })

    expect(igMock.sendCommentReply).not.toHaveBeenCalled()
    expect(igMock.sendPrivateReply).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
  })

  it('does NOT persist the reply when the provider send fails', async () => {
    const { ProviderReplyError } = await import('@/modules/inbox/instagram-reply')
    igMock.sendCommentReply.mockRejectedValueOnce(new ProviderReplyError('IG down'))
    const repo = makeRepo({
      id: 'msg_4',
      externalId: 'cmt_4',
      messageType: 'comment',
      platform: igPlatform,
    })
    const service = new InboxService(repo)

    await expect(service.replyToMessage(AUTH, 'msg_4', { reply: 'پاسخ' })).rejects.toThrow(
      'IG down'
    )
    expect(repo.reply).not.toHaveBeenCalled()
  })

  it('rejects dm replies when the platform has no ig-user-id', async () => {
    const repo = makeRepo({
      id: 'msg_5',
      externalId: 'cmt_5',
      messageType: 'dm',
      platform: { ...igPlatform, targetId: null },
    })
    const service = new InboxService(repo)

    await expect(service.replyToMessage(AUTH, 'msg_5', { reply: 'x' })).rejects.toThrow()
    expect(repo.reply).not.toHaveBeenCalled()
  })

  it('never records an external reply when the Instagram token is missing', async () => {
    const repo = makeRepo({
      id: 'msg_missing_token',
      externalId: 'cmt_external',
      messageType: 'comment',
      platform: { ...igPlatform, tokenSecret: null },
    })
    const service = new InboxService(repo)

    await expect(service.replyToMessage(AUTH, 'msg_missing_token', { reply: 'x' })).rejects.toThrow(
      /دوباره متصل/
    )
    expect(repo.reply).not.toHaveBeenCalled()
  })
})

function makeThreadRepo(thread: Record<string, unknown> | null) {
  return {
    findThreadWithPlatform: vi.fn().mockResolvedValue(thread),
    findMemberByUserInWorkspace: vi.fn().mockResolvedValue({ id: 'member_1' }),
    claimThread: vi.fn().mockResolvedValue({
      ok: true,
      assigneeId: 'member_1',
      lockExpiresAt: new Date(Date.now() + 10 * 60_000),
    }),
    appendThreadReply: vi.fn().mockResolvedValue({ id: 'out_1' }),
    markLegacyRepliedByExternalId: vi.fn().mockResolvedValue(undefined),
  } as unknown as InboxRepository
}

describe('inboxService.replyToThread — DM recipient addressing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    igMock.sendCommentReply.mockResolvedValue({ providerMessageId: 'provider-comment-reply' })
    igMock.sendPrivateReply.mockResolvedValue({ providerMessageId: 'provider-private-reply' })
    igMock.sendDirectMessage.mockResolvedValue({ providerMessageId: 'provider-dm-reply' })
  })

  it('addresses DM replies by the sender IGSID, never by message id', async () => {
    const repo = makeThreadRepo({
      id: 'thr_1',
      providerUserId: 'igsid_777',
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_1',
          providerMessageId: 'mid.HASH123',
          messageType: 'dm',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await service.replyToThread(AUTH, 'thr_1', { reply: 'پاسخ دایرکت' })

    expect(igMock.sendDirectMessage).toHaveBeenCalledWith(
      'dec:enc_token',
      'ig_user_1',
      'igsid_777',
      'پاسخ دایرکت'
    )
    expect(igMock.sendPrivateReply).not.toHaveBeenCalled()
    expect(igMock.sendCommentReply).not.toHaveBeenCalled()
    expect(repo.appendThreadReply).toHaveBeenCalledWith(
      'thr_1',
      'ws_1',
      'plat_1',
      'dm',
      'پاسخ دایرکت',
      'provider-dm-reply'
    )
  })

  it('falls back to thread.providerUserId when the message has no sender id', async () => {
    const repo = makeThreadRepo({
      id: 'thr_2',
      providerUserId: 'igsid_from_thread',
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_2',
          providerMessageId: 'mid.HASH456',
          messageType: 'dm',
          senderExternalId: null,
        },
      ],
    })
    const service = new InboxService(repo)

    await service.replyToThread(AUTH, 'thr_2', { reply: 'x' })

    expect(igMock.sendDirectMessage).toHaveBeenCalledWith(
      'dec:enc_token',
      'ig_user_1',
      'igsid_from_thread',
      'x'
    )
  })

  it('rejects DM replies when no sender id is known at all', async () => {
    const repo = makeThreadRepo({
      id: 'thr_3',
      providerUserId: null,
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_3',
          providerMessageId: 'mid.HASH789',
          messageType: 'dm',
          senderExternalId: null,
        },
      ],
    })
    const service = new InboxService(repo)

    await expect(service.replyToThread(AUTH, 'thr_3', { reply: 'x' })).rejects.toThrow()
    expect(igMock.sendDirectMessage).not.toHaveBeenCalled()
  })

  it('rejects DM replies after the 24h messaging window closes', async () => {
    const repo = makeThreadRepo({
      id: 'thr_win1',
      providerUserId: 'igsid_777',
      lastInboundAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25h ago
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_w1',
          providerMessageId: 'mid.OLD',
          messageType: 'dm',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await expect(service.replyToThread(AUTH, 'thr_win1', { reply: 'x' })).rejects.toThrow(
      /۲۴ ساعته/
    )
    expect(igMock.sendDirectMessage).not.toHaveBeenCalled()
  })

  it('sends DM replies while the 24h window is still open', async () => {
    const repo = makeThreadRepo({
      id: 'thr_win2',
      providerUserId: 'igsid_777',
      lastInboundAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2h ago
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_w2',
          providerMessageId: 'mid.FRESH',
          messageType: 'dm',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await service.replyToThread(AUTH, 'thr_win2', { reply: 'x' })
    expect(igMock.sendDirectMessage).toHaveBeenCalledOnce()
  })

  it('never gates public comment replies on a window', async () => {
    const repo = makeThreadRepo({
      id: 'thr_win3',
      providerUserId: 'igsid_777',
      lastInboundAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_w3',
          providerMessageId: 'cmt_old',
          messageType: 'comment',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await service.replyToThread(AUTH, 'thr_win3', { reply: 'x' })
    expect(igMock.sendCommentReply).toHaveBeenCalledOnce()
  })

  it('still uses the comment reply endpoint for comment threads', async () => {
    const repo = makeThreadRepo({
      id: 'thr_4',
      providerUserId: 'igsid_777',
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_4',
          providerMessageId: 'cmt_42',
          messageType: 'comment',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await service.replyToThread(AUTH, 'thr_4', { reply: 'پاسخ عمومی' })

    expect(igMock.sendCommentReply).toHaveBeenCalledWith('dec:enc_token', 'cmt_42', 'پاسخ عمومی')
    expect(igMock.sendDirectMessage).not.toHaveBeenCalled()
  })

  it('rejects a send when another agent owns the active claim', async () => {
    const repo = makeThreadRepo({
      id: 'thr_claimed',
      providerUserId: 'igsid_777',
      platform: { id: 'plat_1', ...igPlatform },
      messages: [
        {
          id: 'm_claimed',
          providerMessageId: 'mid.CLAIMED',
          messageType: 'dm',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    vi.mocked(repo.claimThread).mockResolvedValueOnce(null)
    const service = new InboxService(repo)

    await expect(service.replyToThread(AUTH, 'thr_claimed', { reply: 'x' })).rejects.toThrow(
      /عضو دیگری/
    )
    expect(igMock.sendDirectMessage).not.toHaveBeenCalled()
    expect(repo.appendThreadReply).not.toHaveBeenCalled()
  })

  it('rejects thread replies when the platform token is missing', async () => {
    const repo = makeThreadRepo({
      id: 'thr_missing_token',
      providerUserId: 'igsid_777',
      platform: { id: 'plat_1', ...igPlatform, tokenSecret: null },
      messages: [
        {
          id: 'm_missing_token',
          providerMessageId: 'mid.MISSING',
          messageType: 'dm',
          senderExternalId: 'igsid_777',
        },
      ],
    })
    const service = new InboxService(repo)

    await expect(service.replyToThread(AUTH, 'thr_missing_token', { reply: 'x' })).rejects.toThrow(
      /دوباره متصل/
    )
    expect(repo.appendThreadReply).not.toHaveBeenCalled()
  })
})

describe('inboxService.replyToThread — Zernio safety', () => {
  const key = '7b8e1250-4205-4c6e-9270-cba566e716cb'
  const zernioThread = () => ({
    id: 'thr_z', providerThreadId: 'conversation-1',
    lastInboundAt: new Date(Date.now() - 60_000),
    platform: { id: 'plat_z', type: 'instagram', provider: 'zernio', providerAccountId: '0123456789abcdef01234567' },
    messages: [{ id: 'msg_z', providerMessageId: 'incoming-1', messageType: 'dm', senderExternalId: 'sender-1' }],
  })

  beforeEach(() => {
    vi.clearAllMocks()
    attemptMock.beginZernioReplyAttempt.mockResolvedValue({ kind: 'send', id: 'attempt-1' })
    attemptMock.completeZernioReplyAttempt.mockResolvedValue('out-1')
    attemptMock.markZernioReplyAttempt.mockResolvedValue(undefined)
    zernioMock.getZernioInboxConversation.mockResolvedValue({ id: 'conversation-1' })
    zernioMock.sendZernioInboxMessage.mockResolvedValue('provider-message-1')
  })

  it('sends and records a DM with the caller-provided stable key', async () => {
    const repo = makeThreadRepo(zernioThread())
    const result = await new InboxService(repo).replyToThread(AUTH, 'thr_z', { reply: 'Hello', idempotencyKey: key })
    expect(attemptMock.beginZernioReplyAttempt).toHaveBeenCalledWith('ws_1', 'thr_z', key, 'Hello')
    expect(zernioMock.sendZernioInboxMessage).toHaveBeenCalledWith(
      '0123456789abcdef01234567', 'conversation-1', 'Hello', key,
    )
    expect(attemptMock.completeZernioReplyAttempt).toHaveBeenCalledWith(expect.objectContaining({
      attemptId: 'attempt-1', providerMessageId: 'provider-message-1',
    }))
    expect(repo.appendThreadReply).not.toHaveBeenCalled()
    expect(result.threadMessageId).toBe('out-1')
  })

  it('replays a completed attempt without sending a second DM', async () => {
    attemptMock.beginZernioReplyAttempt.mockResolvedValue({ kind: 'sent', threadMessageId: 'out-1' })
    const result = await new InboxService(makeThreadRepo(zernioThread())).replyToThread(
      AUTH, 'thr_z', { reply: 'Hello', idempotencyKey: key },
    )
    expect(result.threadMessageId).toBe('out-1')
    expect(zernioMock.sendZernioInboxMessage).not.toHaveBeenCalled()
  })

  it('blocks a DM when the inbound timestamp is unavailable', async () => {
    const repo = makeThreadRepo({ ...zernioThread(), lastInboundAt: null })
    await expect(new InboxService(repo).replyToThread(
      AUTH, 'thr_z', { reply: 'Hello', idempotencyKey: key },
    )).rejects.toMatchObject({ code: 'reply_window_closed' })
    expect(attemptMock.markZernioReplyAttempt).toHaveBeenCalledWith('attempt-1', 'rejected')
    expect(zernioMock.sendZernioInboxMessage).not.toHaveBeenCalled()
  })

  it('marks a timeout as uncertain and never records it as delivered', async () => {
    zernioMock.sendZernioInboxMessage.mockRejectedValue(new Error('timeout'))
    const repo = makeThreadRepo(zernioThread())
    await expect(new InboxService(repo).replyToThread(
      AUTH, 'thr_z', { reply: 'Hello', idempotencyKey: key },
    )).rejects.toMatchObject({ code: 'reply_outcome_unknown' })
    expect(attemptMock.markZernioReplyAttempt).toHaveBeenCalledWith('attempt-1', 'unknown')
    expect(attemptMock.completeZernioReplyAttempt).not.toHaveBeenCalled()
    expect(repo.appendThreadReply).not.toHaveBeenCalled()
  })

  it('releases a local validation failure without treating it as an ambiguous send', async () => {
    const thread = { ...zernioThread(), messages: [{
      id: 'comment-1', providerMessageId: 'comment:123', messageType: 'comment',
      senderExternalId: 'sender-1', payload: {},
    }] }
    await expect(new InboxService(makeThreadRepo(thread)).replyToThread(
      AUTH, 'thr_z', { reply: 'Hello', idempotencyKey: key },
    )).rejects.toMatchObject({ code: 'reply_rejected' })
    expect(attemptMock.markZernioReplyAttempt).toHaveBeenCalledWith('attempt-1', 'rejected')
    expect(zernioMock.sendZernioCommentReply).not.toHaveBeenCalled()
  })
})
