import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  bootstrapStagingOwner,
  validateStagingBootstrap,
} from '../../../scripts/bootstrap-staging-owner'

const password = 'Staging-only-strong-secret-2026!'
const confirmation = 'create-on-empty-staging-only'

describe('staging owner bootstrap', () => {
  it('accepts only the designated HTTPS staging site, owner email, and a strong password', () => {
    expect(
      validateStagingBootstrap({
        appUrl: 'https://staging.odooshoping.ir',
        ownerEmail: ' Owner@Example.com ',
        password,
        confirmation,
      })
    ).toBe('owner@example.com')
    expect(() =>
      validateStagingBootstrap({
        appUrl: 'https://odooshoping.ir',
        ownerEmail: 'owner@example.com',
        password,
        confirmation,
      })
    ).toThrow('restricted')
    expect(() =>
      validateStagingBootstrap({
        appUrl: 'https://staging.odooshoping.ir',
        ownerEmail: 'not-an-email',
        password,
        confirmation,
      })
    ).toThrow('PLATFORM_OWNER_EMAIL')
    expect(() =>
      validateStagingBootstrap({
        appUrl: 'https://staging.odooshoping.ir',
        ownerEmail: 'owner@example.com',
        password: 'admin',
        confirmation,
      })
    ).toThrow('strong temporary app password')
    expect(() =>
      validateStagingBootstrap({
        appUrl: 'https://staging.odooshoping.ir',
        ownerEmail: 'owner@example.com',
        password,
        confirmation: undefined,
      })
    ).toThrow('explicit staging confirmation')
  })

  it('refuses an existing database without creating a user or workspace', async () => {
    const tx = {
      user: { count: vi.fn().mockResolvedValue(1), create: vi.fn() },
      workspace: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    }
    const database = { $transaction: vi.fn((callback) => callback(tx)) } as unknown as PrismaClient
    await expect(bootstrapStagingOwner(database, 'owner@example.com', password)).rejects.toThrow(
      'empty staging database'
    )
    expect(tx.user.create).not.toHaveBeenCalled()
    expect(tx.workspace.create).not.toHaveBeenCalled()
  })

  it('creates only the initial owner, admin membership, and audit record atomically', async () => {
    const tx = {
      user: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'owner-1' }),
      },
      workspace: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'workspace-1' }),
      },
      workspaceMember: { create: vi.fn() },
      auditLog: { create: vi.fn() },
    }
    const database = { $transaction: vi.fn((callback) => callback(tx)) } as unknown as PrismaClient
    await expect(bootstrapStagingOwner(database, 'owner@example.com', password)).resolves.toEqual({
      ownerId: 'owner-1',
      workspaceId: 'workspace-1',
    })
    expect(tx.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'owner@example.com',
        sessionVersion: 0,
        passwordHash: expect.stringMatching(/^\$argon2id\$/),
      }),
      select: { id: true },
    })
    expect(tx.workspace.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        slug: expect.stringMatching(/^staging-owner-[a-f0-9]{16}$/),
      }),
      select: { id: true },
    })
    expect(tx.workspaceMember.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        userId: 'owner-1',
        name: 'Staging owner',
        email: 'owner@example.com',
        role: 'admin',
      },
    })
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'owner-1',
        workspaceId: 'workspace-1',
        action: 'staging.owner_bootstrapped',
        resource: 'User',
      },
    })
  })
})
