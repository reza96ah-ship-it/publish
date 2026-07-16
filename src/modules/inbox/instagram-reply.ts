/**
 * Instagram reply transport for the inbox — sends replies to the real
 * commenter via the Graph API instead of only writing them to the local DB.
 *
 * Two send paths, chosen by the message type:
 *   - comment → POST /{comment-id}/replies      (public nested reply)
 *   - dm      → POST /{ig-user-id}/messages     (private reply via comment_id;
 *               the only Graph-supported way to DM a commenter, 7-day window)
 *
 * Permissions: instagram_business_manage_comments (replies) and
 * instagram_business_manage_messages (private replies) on the platform's token.
 *
 * Mirrors mini-services/publish-worker/lib/instagram-messaging.ts — kept
 * separate because src/ and the worker never import from each other
 * (the worker Docker image excludes src/, the app excludes mini-services/).
 */

import { getInstagramGraphApiBaseUrl } from '../../../shared/instagram-graph'

const GRAPH_API = getInstagramGraphApiBaseUrl()
const TIMEOUT_MS = 15_000

export class ProviderReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderReplyError'
  }
}

export interface ProviderReplyReceipt {
  providerMessageId: string | null
}

async function graphPost(url: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new ProviderReplyError('ارتباط با اینستاگرام برقرار نشد — بعداً دوباره تلاش کنید')
  }
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null
  const error = data?.error as { message?: string } | undefined
  if (!res.ok || !data || error) {
    throw new ProviderReplyError(
      `ارسال پاسخ به اینستاگرام ناموفق بود${error?.message ? `: ${error.message}` : ''}`
    )
  }
  return data
}

function toReceipt(data: Record<string, unknown>): ProviderReplyReceipt {
  const id = data.message_id ?? data.id
  return { providerMessageId: typeof id === 'string' && id.length > 0 ? id : null }
}

/** Public nested reply under the original comment. */
export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  replyText: string
): Promise<ProviderReplyReceipt> {
  const data = await graphPost(`${GRAPH_API}/${commentId}/replies`, {
    message: replyText,
    access_token: accessToken,
  })
  return toReceipt(data)
}

/** Private reply (DM) to the commenter, addressed by comment_id. */
export async function sendPrivateReply(
  accessToken: string,
  igUserId: string,
  commentId: string,
  replyText: string
): Promise<ProviderReplyReceipt> {
  const data = await graphPost(`${GRAPH_API}/${igUserId}/messages`, {
    recipient: { comment_id: commentId },
    message: { text: replyText },
    messaging_type: 'RESPONSE',
    access_token: accessToken,
  })
  return toReceipt(data)
}

/**
 * Reply inside a DM conversation, addressed by the sender's Instagram-scoped
 * ID (IGSID). This is the correct recipient form for webhook-ingested DM
 * threads — recipient.comment_id is only valid for comment private replies,
 * and passing a DM message id there is rejected by the Graph API.
 */
export async function sendDirectMessage(
  accessToken: string,
  igUserId: string,
  recipientIgsid: string,
  replyText: string
): Promise<ProviderReplyReceipt> {
  const data = await graphPost(`${GRAPH_API}/${igUserId}/messages`, {
    recipient: { id: recipientIgsid },
    message: { text: replyText },
    messaging_type: 'RESPONSE',
    access_token: accessToken,
  })
  return toReceipt(data)
}
