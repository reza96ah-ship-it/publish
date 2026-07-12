import { describe, it, expect, beforeEach, vi } from 'vitest'

const { igMock } = vi.hoisted(() => ({
  igMock: {
    sendCommentReply: vi.fn(),
    sendPrivateReply: vi.fn(),
    sendDirectMessage: vi.fn(),
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
  beforeEach(() => vi.clearAllMocks())

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
})

function makeThreadRepo(thread: Record<string, unknown> | null) {
  return {
    findThreadWithPlatform: vi.fn().mockResolvedValue(thread),
    appendThreadReply: vi.fn().mockResolvedValue({ id: 'out_1' }),
    markLegacyRepliedByExternalId: vi.fn().mockResolvedValue(undefined),
  } as unknown as InboxRepository
}

describe('inboxService.replyToThread — DM recipient addressing', () => {
  beforeEach(() => vi.clearAllMocks())

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
})
