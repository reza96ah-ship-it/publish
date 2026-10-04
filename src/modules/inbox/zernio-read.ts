import {
  getZernioInboxConversation,
  listZernioInboxConversations,
  listZernioInboxMessages,
  ZernioApiError,
} from '@/lib/zernio'
import { listOwnedWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'

async function workspaceAccounts(workspaceId: string) {
  const connection = await listOwnedWorkspaceZernioInstagram(workspaceId)
  return connection ? { ...connection, accounts: connection.accounts.filter((account) => account.isActive) } : null
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
