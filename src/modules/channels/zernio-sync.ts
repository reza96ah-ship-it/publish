import { db } from '@/lib/db'
import { listInstagramAccounts, type ZernioInstagramAccount } from '@/lib/zernio'

export async function syncWorkspaceZernioInstagram(workspaceId: string): Promise<ZernioInstagramAccount[]> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return []

  const accounts = await listInstagramAccounts(workspace.zernioProfileId)
  for (const account of accounts) {
    const existing = await db.platform.findUnique({
      where: { provider_providerAccountId: { provider: 'zernio', providerAccountId: account.id } },
      select: { workspaceId: true },
    })
    // Never move an account between workspaces merely because a provider list
    // returned it. Ownership is established by the original OAuth profile.
    if (existing && existing.workspaceId !== workspaceId) continue

    if (!existing && account.username) {
      const directMatch = await db.platform.findFirst({
        where: {
          workspaceId,
          type: 'instagram',
          provider: 'direct',
          username: { equals: account.username, mode: 'insensitive' },
        },
        select: { id: true },
      })
      if (directMatch) {
        // Preserve this account's existing jobs, Inbox history, and UI card.
        await db.platform.update({
          where: { id: directMatch.id },
          data: {
            provider: 'zernio', providerAccountId: account.id,
            name: account.displayName || `@${account.username}`,
            username: account.username,
            avatarUrl: account.avatarUrl,
            status: account.isActive ? 'active' : 'disconnected',
            accountKind: 'professional',
          },
        })
        continue
      }
    }

    await db.platform.upsert({
      where: { provider_providerAccountId: { provider: 'zernio', providerAccountId: account.id } },
      create: {
        workspaceId,
        type: 'instagram',
        provider: 'zernio',
        providerAccountId: account.id,
        name: account.displayName || `@${account.username}`,
        username: account.username,
        avatarUrl: account.avatarUrl,
        status: account.isActive ? 'active' : 'disconnected',
        accountKind: 'professional',
      },
      update: {
        name: account.displayName || `@${account.username}`,
        username: account.username,
        avatarUrl: account.avatarUrl,
        status: account.isActive ? 'active' : 'disconnected',
      },
    })
  }
  return accounts
}
