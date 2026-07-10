import { describe, it, expect, beforeEach, vi } from 'vitest'

const { igMock } = vi.hoisted(() => ({
  igMock: {
    sendCommentReply: vi.fn(),
    sendPrivateReply: vi.fn(),
  },
}))

vi.mock('@/lib/crypto', () => ({ decrypt: vi.fn((v: string) => `dec:${v}`) }))
vi.mock('@/modules/inbox/instagram-reply', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/modules/inbox/instagram-reply')>()
  return {
    ProviderReplyError: actual.ProviderReplyError,
    sendCommentReply: igMock.sendCommentReply,
    sendPrivateReply: igMock.sendPrivateReply,
  }
})

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
