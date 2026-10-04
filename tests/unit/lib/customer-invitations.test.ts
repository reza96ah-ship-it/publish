import { beforeEach, describe, expect, it, vi } from 'vitest'

const tx = vi.hoisted(() => ({
  workspace: { create: vi.fn() },
  workspaceInvitation: { updateMany: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
  workspaceMember: { create: vi.fn() },
  user: { create: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn() },
    workspaceInvitation: { findUnique: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  },
}))
vi.mock('@/lib/password', () => ({ hashPassword: vi.fn(async () => 'argon2-hash') }))

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'
import { acceptCustomerInvitation, CustomerInvitationError, issueCustomerInvitation, listCustomerInvitations, revokeCustomerInvitation } from '@/lib/customer-invitations'

const input = { token: 'a'.repeat(43), email: 'customer@example.com', name: 'Customer', password: 'long-test-password-123' }

function invitation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'invitation-1', workspaceId: 'workspace-1', emailNormalized: input.email,
    role: 'admin', acceptedAt: null, revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000), workspace: { members: [] },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.user.findUnique).mockResolvedValue(null)
  vi.mocked(db.workspaceInvitation.findUnique).mockResolvedValue(invitation() as never)
  tx.workspace.create.mockResolvedValue({ id: 'workspace-1' })
  tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 1 })
  tx.user.create.mockResolvedValue({ id: 'user-1', email: input.email })
  tx.workspaceInvitation.update.mockResolvedValue({})
  tx.workspaceInvitation.findUnique.mockResolvedValue({ workspaceId: 'workspace-1' })
  tx.workspaceMember.create.mockResolvedValue({})
  tx.auditLog.create.mockResolvedValue({})
})

describe('new-customer invitation', () => {
  it('issues a hashed, seven-day invitation in a distinct empty workspace', async () => {
    const result = await issueCustomerInvitation({ ownerId: 'owner-1', email: ' CUSTOMER@EXAMPLE.COM ', workspaceName: 'Shop' })
    expect(result.email).toBe(input.email)
    expect(result.token).toHaveLength(43)
    expect(tx.workspace.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        slug: expect.stringMatching(/^customer-[0-9a-f]{24}$/),
        invitations: { create: expect.objectContaining({
          emailNormalized: input.email, role: 'admin', invitedById: 'owner-1', tokenHash: expect.any(String),
        }) },
      }),
    }))
    const storedHash = tx.workspace.create.mock.calls[0][0].data.invitations.create.tokenHash
    expect(storedHash).not.toBe(result.token)
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: 'workspace-1' }) })
  })

  it('does not issue a new-account invite for an existing email', async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({ id: 'existing' } as never)
    await expect(issueCustomerInvitation({ ownerId: 'owner-1', email: input.email, workspaceName: 'Shop' }))
      .rejects.toMatchObject({ status: 409 })
    expect(tx.workspace.create).not.toHaveBeenCalled()
  })

  it('lists only pending, empty-workspace invitations by issuer', async () => {
    vi.mocked(db.workspaceInvitation.findMany).mockResolvedValue([])
    await listCustomerInvitations('owner-1')
    expect(db.workspaceInvitation.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ invitedById: 'owner-1', acceptedAt: null, revokedAt: null, workspace: { members: { none: {} } } }),
    }))
  })

  it("revokes only the owner's unaccepted invitation and audits the change", async () => {
    await expect(revokeCustomerInvitation('owner-1', 'invitation-1')).resolves.toBe(true)
    expect(tx.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'invitation-1', invitedById: 'owner-1', acceptedAt: null, revokedAt: null }),
      data: { revokedAt: expect.any(Date) },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: 'workspace-1' }) })
  })

  it('cannot revoke an invite claimed by another owner', async () => {
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 0 })
    await expect(revokeCustomerInvitation('other', 'invitation-1')).rejects.toMatchObject({ status: 404 })
    expect(tx.auditLog.create).not.toHaveBeenCalled()
  })

  it.each([
    ['expired', { expiresAt: new Date(Date.now() - 60_000) }],
    ['revoked', { revokedAt: new Date() }],
    ['accepted', { acceptedAt: new Date() }],
    ['occupied workspace', { workspace: { members: [{ id: 'member-1' }] } }],
    ['wrong role', { role: 'viewer' }],
  ])('rejects an %s invitation before creating credentials', async (_name, changes) => {
    vi.mocked(db.workspaceInvitation.findUnique).mockResolvedValue(invitation(changes) as never)
    await expect(acceptCustomerInvitation(input)).rejects.toBeInstanceOf(CustomerInvitationError)
    expect(hashPassword).not.toHaveBeenCalled()
    expect(tx.user.create).not.toHaveBeenCalled()
  })

  it('rejects a mismatched recipient email', async () => {
    await expect(acceptCustomerInvitation({ ...input, email: 'wrong@example.com' })).rejects.toMatchObject({ status: 400 })
  })

  it('claims the token before creating the user and admin membership', async () => {
    const result = await acceptCustomerInvitation(input)
    expect(result).toEqual({ email: input.email, workspaceId: 'workspace-1' })
    expect(tx.workspaceInvitation.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        acceptedAt: null, revokedAt: null, role: 'admin',
        workspace: { members: { none: {} } },
      }),
      data: { acceptedAt: expect.any(Date) },
    })
    expect(tx.user.create).toHaveBeenCalledWith({
      data: { email: input.email, name: input.name, passwordHash: 'argon2-hash' },
      select: { id: true, email: true },
    })
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({ data: expect.objectContaining({ workspaceId: 'workspace-1', userId: 'user-1', role: 'admin' }) })
  })

  it('rejects an already claimed token without creating an account', async () => {
    tx.workspaceInvitation.updateMany.mockResolvedValue({ count: 0 })
    await expect(acceptCustomerInvitation(input)).rejects.toMatchObject({ status: 400 })
    expect(tx.user.create).not.toHaveBeenCalled()
  })
})
