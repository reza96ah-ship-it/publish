import { db } from '@/lib/db'
import { listInstagramAccounts, type ZernioInstagramAccount } from '@/lib/zernio'

export async function syncWorkspaceZernioInstagram(workspaceId: string): Promise<ZernioInstagramAccount[]> {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return []

  const accounts = await listInstagramAccounts(workspace.zernioProfileId)
  const owned: ZernioInstagramAccount[] = []
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
        owned.push(account)
        continue
      }
    }

    const providerAccount = { provider: 'zernio', providerAccountId: account.id }
    if (existing) {
      await db.platform.update({
        where: { provider_providerAccountId: providerAccount, workspaceId },
        data: {
          name: account.displayName || `@${account.username}`,
          username: account.username,
          avatarUrl: account.avatarUrl,
          status: account.isActive ? 'active' : 'disconnected',
        },
      })
    } else {
      // A concurrent create from another workspace must fail on the provider
      // account unique constraint, never turn into an update of its row.
      await db.platform.create({
        data: {
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
      })
    }
    owned.push(account)
  }
  return owned
}

/** Only expose accounts that are both in this Zernio profile and owned locally. */
export async function listOwnedWorkspaceZernioInstagram(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return null
  const accounts = await listInstagramAccounts(workspace.zernioProfileId)
  if (accounts.length === 0) return { profileId: workspace.zernioProfileId, accounts }
  const platforms = await db.platform.findMany({
    where: {
      workspaceId,
      provider: 'zernio',
      type: 'instagram',
      providerAccountId: { in: accounts.map((account) => account.id) },
    },
    select: { providerAccountId: true },
  })
  const ownedIds = new Set(platforms.map((platform) => platform.providerAccountId))
  return {
    profileId: workspace.zernioProfileId,
    accounts: accounts.filter((account) => ownedIds.has(account.id)),
  }
}
