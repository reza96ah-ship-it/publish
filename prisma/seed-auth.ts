/**
 * Seed a demo user for testing auth.
 * Run: bun run seed:auth
 *
 * Creates:
 *   - User: demo@nashrino.ir / password: demo1234
 *   - Links the user to the first workspace as admin
 */

import { db } from '../src/lib/db'
import { hashPassword } from '../src/lib/password'

async function main() {
  const email = 'demo@nashrino.ir'
  const password = 'demo1234'

  // Find or create the user
  let user = await db.user.findUnique({ where: { email } })

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: 'کاربر دمو نشرینو',
        passwordHash: await hashPassword(password),
        emailVerified: new Date(),
      },
    })
    console.log(`✓ Created user: ${email}`)
  } else {
    // Update password in case it changed
    user = await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(password), emailVerified: new Date() },
    })
    console.log(`✓ Updated user password: ${email}`)
  }

  // Find the first workspace
  const workspace = await db.workspace.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!workspace) {
    console.log('✗ No workspace found — run prisma/seed.ts first')
    return
  }

  // Link user to workspace as admin (if not already linked)
  const existingMember = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
  })

  if (!existingMember) {
    await db.workspaceMember.create({
      data: {
        workspaceId: workspace.id,
        userId: user.id,
        name: user.name ?? 'کاربر دمو',
        email: user.email ?? '',
        role: 'admin',
      },
    })
    console.log(`✓ Linked user to workspace "${workspace.name}" as admin`)
  } else {
    console.log(`✓ User already linked to workspace`)
  }

  // Update all existing members to link to the user (so the demo data shows up)
  const unlinkedMembers = await db.workspaceMember.findMany({
    where: { userId: 'system' },
  })
  for (const m of unlinkedMembers) {
    await db.workspaceMember.update({
      where: { id: m.id },
      data: { userId: user.id },
    })
  }
  if (unlinkedMembers.length > 0) {
    console.log(`✓ Linked ${unlinkedMembers.length} existing members to user`)
  }

  console.log('\n=== Demo credentials ===')
  console.log(`Email: ${email}`)
  console.log(`Password: ${password}`)
  console.log('========================\n')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
