/** One-time owner bootstrap for a fresh, isolated staging database. */
import { randomBytes } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { hashPassword } from '../src/lib/password'
import { isStrongAppPassword } from '../src/lib/password-policy'

const STAGING_ORIGIN = 'https://staging.odooshoping.ir'
const CONFIRMATION = 'create-on-empty-staging-only'

export function validateStagingBootstrap(input: {
  appUrl: string | undefined
  ownerEmail: string | undefined
  password: string
  confirmation: string | undefined
}): string {
  if (input.confirmation !== CONFIRMATION) {
    throw new Error('Owner bootstrap requires explicit staging confirmation')
  }
  if (input.appUrl !== STAGING_ORIGIN) {
    throw new Error(`Owner bootstrap is restricted to ${STAGING_ORIGIN}`)
  }
  const email = input.ownerEmail?.trim().toLowerCase() ?? ''
  if (!z.email().safeParse(email).success) throw new Error('Set a valid PLATFORM_OWNER_EMAIL')
  if (!isStrongAppPassword(input.password, email)) {
    throw new Error('Use a strong temporary app password (12–128 characters)')
  }
  return email
}

export async function bootstrapStagingOwner(
  database: PrismaClient,
  email: string,
  password: string
) {
  const passwordHash = await hashPassword(password)
  return database.$transaction(async (tx) => {
    // Refuse to seed a demo or existing customer database. Both checks and
    // writes share one transaction; a concurrent bootstrap rolls back on the
    // unique owner email instead of leaving a partial workspace.
    const [userCount, workspaceCount] = await Promise.all([tx.user.count(), tx.workspace.count()])
    if (userCount !== 0 || workspaceCount !== 0) {
      throw new Error('Owner bootstrap requires an empty staging database')
    }

    const owner = await tx.user.create({
      data: { email, name: 'Staging owner', passwordHash, sessionVersion: 0 },
      select: { id: true },
    })
    const workspace = await tx.workspace.create({
      data: {
        name: 'Staging owner workspace',
        slug: `staging-owner-${randomBytes(8).toString('hex')}`,
      },
      select: { id: true },
    })
    await tx.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: owner.id,
        name: 'Staging owner',
        email,
        role: 'admin',
      },
    })
    await tx.auditLog.create({
      data: {
        userId: owner.id,
        workspaceId: workspace.id,
        action: 'staging.owner_bootstrapped',
        resource: 'User',
      },
    })
    return { ownerId: owner.id, workspaceId: workspace.id }
  })
}

async function main() {
  if (process.env.STAGING_OWNER_BOOTSTRAP_CONFIRM !== CONFIRMATION) {
    throw new Error('Owner bootstrap requires explicit staging confirmation')
  }
  if (process.env.NEXTAUTH_URL !== STAGING_ORIGIN) {
    throw new Error(`Owner bootstrap is restricted to ${STAGING_ORIGIN}`)
  }
  if (process.stdin.isTTY) {
    throw new Error(
      'Pipe the temporary password on stdin; do not type it into the container terminal'
    )
  }
  let passwordInput = ''
  for await (const chunk of process.stdin) {
    passwordInput += chunk.toString()
    if (passwordInput.length > 4096) throw new Error('Temporary app password input is too long')
  }
  const password = passwordInput.replace(/\r?\n$/, '')
  const email = validateStagingBootstrap({
    appUrl: process.env.NEXTAUTH_URL,
    ownerEmail: process.env.PLATFORM_OWNER_EMAIL,
    password,
    confirmation: process.env.STAGING_OWNER_BOOTSTRAP_CONFIRM,
  })
  const { db } = await import('../src/lib/db')
  try {
    const created = await bootstrapStagingOwner(db, email, password)
    console.log(
      `Staging owner created in workspace ${created.workspaceId}. Rotate the app password before issuing invitations.`
    )
  } finally {
    await db.$disconnect()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    // Never log the password, database URL, or a raw Prisma error.
    console.error(
      error instanceof Error &&
        (error.message.startsWith('Owner bootstrap') ||
          error.message.startsWith('Set a valid PLATFORM_OWNER_EMAIL') ||
          error.message.startsWith('Use a strong temporary app password'))
        ? error.message
        : 'Staging owner bootstrap failed; verify the isolated database and configuration'
    )
    process.exitCode = 1
  })
}
