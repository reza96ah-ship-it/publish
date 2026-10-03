import { db } from '@/lib/db'
import {
  getZernioInboxConversation,
  listInstagramAccounts,
  listZernioInboxConversations,
  listZernioInboxMessages,
  ZernioApiError,
} from '@/lib/zernio'

async function workspaceAccounts(workspaceId: string) {
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { zernioProfileId: true },
  })
  if (!workspace?.zernioProfileId) return null
  const accounts = (await listInstagramAccounts(workspace.zernioProfileId))
    .filter((account) => account.isActive)
  return { profileId: workspace.zernioProfileId, accounts }
}

export async function listWorkspaceZernioConversations(workspaceId: string, cursor?: string) {
  const connection = await workspaceAccounts(workspaceId)
  if (!connection || connection.accounts.length === 0) {
    return { connected: false, data: [], nextCursor: null, accountsFailed: 0 }
  }

  const allowedIds = new Set(connection.accounts.map((account) => account.id))
  const page = await listZernioInboxConversations(connection.profileId, cursor)
  return {
    connected: true,
    ...page,
    data: page.data.filter((conversation) => allowedIds.has(conversation.accountId)),
  }
}

export async function listWorkspaceZernioMessages(
  workspaceId: string,
  accountId: string,
  conversationId: string,
  cursor?: string,
) {
  const connection = await workspaceAccounts(workspaceId)
  if (!connection?.accounts.some((account) => account.id === accountId)) {
    throw new ZernioApiError(404, 'conversation_not_found')
  }
  // A conversation ID from the browser is untrusted. Verify its account and
  // platform with Zernio before requesting or returning message content.
  await getZernioInboxConversation(accountId, conversationId)
  return listZernioInboxMessages(accountId, conversationId, cursor)
}
