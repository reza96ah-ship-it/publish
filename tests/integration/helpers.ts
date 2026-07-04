/**
 * Issue #153: Test data isolation helpers.
 *
 * Every integration test creates and destroys its own workspace/resources.
 * No shared mutable demo data across parallel tests.
 */

import { db } from '@/lib/db'
import { hashPassword } from '@/lib/password'

let counter = 0

/**
 * Generate a unique ID for test resources (avoids collisions in parallel tests).
 */
export function testId(prefix = 'test'): string {
  counter++
  return `${prefix}-${Date.now()}-${counter}-${Math.random().toString(36).substring(7)}`
}

/**
 * Create a test workspace + admin user + membership in one call.
 * Returns the IDs for use in tests.
 * Clean up with cleanupTestWorkspace().
 */
export async function createTestWorkspace(opts?: {
  name?: string
  userEmail?: string
  userPassword?: string
}): Promise<{
  workspaceId: string
  userId: string
  membershipId: string
  email: string
  password: string
}> {
  const id = testId('ws')
  const email = opts?.userEmail || `test-${id}@nashrino.test`
  const password = opts?.userPassword || 'test1234'

  const user = await db.user.create({
    data: {
      email,
      name: `Test User ${id}`,
      passwordHash: await hashPassword(password),
      emailVerified: new Date(),
    },
  })

  const workspace = await db.workspace.create({
    data: {
      name: opts?.name || `Test Workspace ${id}`,
      slug: `test-${id}`,
    },
  })

  const membership = await db.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      name: `Admin ${id}`,
      email,
      role: 'admin',
    },
  })

  return {
    workspaceId: workspace.id,
    userId: user.id,
    membershipId: membership.id,
    email,
    password,
  }
}

/**
 * Create a test platform (channel) in a workspace.
 */
export async function createTestPlatform(workspaceId: string, type: string = 'telegram'): Promise<{
  platformId: string
  type: string
}> {
  const platform = await db.platform.create({
    data: {
      workspaceId,
      type,
      name: `Test ${type} ${testId('plat')}`,
      username: `@test_${type}`,
      status: 'active',
      tokenSecret: null, // set by individual tests if needed
    },
  })
  return { platformId: platform.id, type: platform.type }
}

/**
 * Create test media in a workspace.
 */
export async function createTestMedia(workspaceId: string): Promise<{
  mediaId: string
  url: string
}> {
  const media = await db.media.create({
    data: {
      workspaceId,
      name: `test-image-${testId('media')}.jpg`,
      fileType: 'image/jpeg',
      fileSize: 1024,
      url: 'https://example.com/test-image.jpg',
      thumbnailUrl: 'https://example.com/test-thumb.jpg',
    },
  })
  return { mediaId: media.id, url: media.url }
}

/**
 * Clean up all test resources for a workspace.
 * Deletes workspace (cascades to all related records).
 */
export async function cleanupTestWorkspace(workspaceId: string): Promise<void> {
  try {
    await db.workspace.delete({ where: { id: workspaceId } })
  } catch {
    // Already deleted or doesn't exist — that's fine
  }
}

/**
 * Clean up a test user.
 */
export async function cleanupTestUser(userId: string): Promise<void> {
  try {
    await db.user.delete({ where: { id: userId } })
  } catch {
    // Already deleted
  }
}
