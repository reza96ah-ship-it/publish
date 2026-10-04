import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findWorkspace: vi.fn(),
  findPlatforms: vi.fn(),
  listAccounts: vi.fn(),
  listConversations: vi.fn(),
  getConversation: vi.fn(),
  listMessages: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: {
  workspace: { findUnique: mocks.findWorkspace },
  platform: { findMany: mocks.findPlatforms },
} }))
vi.mock('@/lib/zernio', () => ({
  ZernioApiError: class extends Error {
    constructor(public status: number, public code: string) { super(code) }
  },
  listInstagramAccounts: mocks.listAccounts,
  listZernioInboxConversations: mocks.listConversations,
  getZernioInboxConversation: mocks.getConversation,
  listZernioInboxMessages: mocks.listMessages,
}))

import { listWorkspaceZernioConversations, listWorkspaceZernioMessages } from '@/modules/inbox/zernio-read'

const accountId = '66b2e19d8c3f5a7e9d0b1c2d'
const otherId = '66b2e19d8c3f5a7e9d0b1c2e'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.findWorkspace.mockResolvedValue({ zernioProfileId: '66a1f0c2a4b9d3e8f1a2b3c4' })
  mocks.listAccounts.mockResolvedValue([{ id: accountId, isActive: true }, { id: otherId, isActive: false }])
  mocks.findPlatforms.mockResolvedValue([{ providerAccountId: accountId }])
})

describe('workspace-scoped Zernio inbox', () => {
  it('filters provider conversations to active accounts in the workspace', async () => {
    mocks.listConversations.mockResolvedValue({ data: [
      { id: 'own', accountId }, { id: 'other', accountId: otherId },
    ], nextCursor: null, accountsFailed: 0 })
    const result = await listWorkspaceZernioConversations('workspace-1')
    expect(result.data).toEqual([{ id: 'own', accountId }])
    expect(mocks.listConversations).toHaveBeenCalledWith('66a1f0c2a4b9d3e8f1a2b3c4', undefined)
  })

  it('never fetches messages for an account outside the workspace', async () => {
    await expect(listWorkspaceZernioMessages('workspace-1', otherId, 'thread'))
      .rejects.toMatchObject({ status: 404, code: 'conversation_not_found' })
    expect(mocks.getConversation).not.toHaveBeenCalled()
    expect(mocks.listMessages).not.toHaveBeenCalled()
  })

  it('does not expose an active account listed by Zernio but owned by another workspace', async () => {
    mocks.listAccounts.mockResolvedValue([{ id: accountId, isActive: true }, { id: otherId, isActive: true }])
    mocks.listConversations.mockResolvedValue({ data: [{ id: 'foreign', accountId: otherId }], nextCursor: null, accountsFailed: 0 })
    const conversations = await listWorkspaceZernioConversations('workspace-1')
    expect(conversations.data).toEqual([])
    await expect(listWorkspaceZernioMessages('workspace-1', otherId, 'foreign'))
      .rejects.toMatchObject({ status: 404, code: 'conversation_not_found' })
    expect(mocks.getConversation).not.toHaveBeenCalled()
  })

  it('verifies conversation ownership before returning messages', async () => {
    mocks.getConversation.mockResolvedValue({ id: 'thread', accountId })
    mocks.listMessages.mockResolvedValue({ data: [{ id: 'message' }], nextCursor: null })
    await expect(listWorkspaceZernioMessages('workspace-1', accountId, 'thread'))
      .resolves.toMatchObject({ data: [{ id: 'message' }] })
    expect(mocks.getConversation).toHaveBeenCalledWith(accountId, 'thread')
    expect(mocks.listMessages).toHaveBeenCalledWith(accountId, 'thread', undefined)
  })
})
