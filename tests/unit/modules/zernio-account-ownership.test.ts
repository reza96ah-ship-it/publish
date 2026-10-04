import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  workspace: vi.fn(),
  accounts: vi.fn(),
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ db: {
  workspace: { findUnique: mocks.workspace },
  platform: {
    findUnique: mocks.findUnique,
    findFirst: mocks.findFirst,
    findMany: mocks.findMany,
    create: mocks.create,
    update: mocks.update,
  },
} }))
vi.mock('@/lib/zernio', () => ({ listInstagramAccounts: mocks.accounts }))

import {
  listOwnedWorkspaceZernioInstagram,
  syncWorkspaceZernioInstagram,
} from '@/modules/channels/zernio-sync'

const ownId = '66b2e19d8c3f5a7e9d0b1c2d'
const otherId = '66b2e19d8c3f5a7e9d0b1c2e'
const own = { id: ownId, username: 'own', isActive: true }
const other = { id: otherId, username: 'other', isActive: true }

beforeEach(() => {
  vi.clearAllMocks()
  mocks.workspace.mockResolvedValue({ zernioProfileId: '66a1f0c2a4b9d3e8f1a2b3c4' })
  mocks.accounts.mockResolvedValue([own, other])
  mocks.findFirst.mockResolvedValue(null)
  mocks.findUnique.mockImplementation(({ where }) => Promise.resolve(
    where.provider_providerAccountId.providerAccountId === otherId
      ? { workspaceId: 'workspace-2' }
      : { workspaceId: 'workspace-1' },
  ))
  mocks.create.mockResolvedValue({ workspaceId: 'workspace-1' })
  mocks.findMany.mockResolvedValue([{ providerAccountId: ownId }])
})

describe('workspace-owned Zernio accounts', () => {
  it('does not return or update an account already owned by another workspace', async () => {
    await expect(syncWorkspaceZernioInstagram('workspace-1')).resolves.toEqual([own])
    expect(mocks.update).toHaveBeenCalledOnce()
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { provider_providerAccountId: { provider: 'zernio', providerAccountId: ownId }, workspaceId: 'workspace-1' },
    }))
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('fails closed when another workspace creates the account concurrently', async () => {
    mocks.findUnique.mockResolvedValue(null)
    mocks.create.mockRejectedValue({ code: 'P2002' })
    await expect(syncWorkspaceZernioInstagram('workspace-1')).rejects.toMatchObject({ code: 'P2002' })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('creates a newly connected account in its own workspace', async () => {
    mocks.accounts.mockResolvedValue([own])
    mocks.findUnique.mockResolvedValue(null)
    await expect(syncWorkspaceZernioInstagram('workspace-1')).resolves.toEqual([own])
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      workspaceId: 'workspace-1', provider: 'zernio', providerAccountId: ownId,
    }) })
  })

  it('converts a matching direct connection without creating a duplicate', async () => {
    mocks.accounts.mockResolvedValue([own])
    mocks.findUnique.mockResolvedValue(null)
    mocks.findFirst.mockResolvedValue({ id: 'direct-platform' })
    await expect(syncWorkspaceZernioInstagram('workspace-1')).resolves.toEqual([own])
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'direct-platform' },
      data: expect.objectContaining({ provider: 'zernio', providerAccountId: ownId }),
    }))
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('lists only accounts both in the profile and locally owned', async () => {
    await expect(listOwnedWorkspaceZernioInstagram('workspace-1')).resolves.toEqual({
      profileId: '66a1f0c2a4b9d3e8f1a2b3c4',
      accounts: [own],
    })
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ workspaceId: 'workspace-1', provider: 'zernio' }),
    }))
  })
})
