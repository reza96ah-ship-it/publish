/**
 * Instagram reply transport for the inbox — sends replies to the real
 * commenter via the Graph API instead of only writing them to the local DB.
 *
 * Two send paths, chosen by the message type:
 *   - comment → POST /{comment-id}/replies      (public nested reply)
 *   - dm      → POST /{ig-user-id}/messages     (private reply via comment_id;
 *               the only Graph-supported way to DM a commenter, 7-day window)
 *
 * Permissions: instagram_manage_comments (replies) and
 * instagram_manage_messages (private replies) on the platform's token.
 *
 * Mirrors mini-services/publish-worker/lib/instagram-messaging.ts — kept
 * separate because src/ and the worker never import from each other
 * (the worker Docker image excludes src/, the app excludes mini-services/).
 */

const IG_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'
const GRAPH_API = `https://graph.facebook.com/${IG_GRAPH_VERSION}`
const TIMEOUT_MS = 15_000

export class ProviderReplyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProviderReplyError'
  }
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
  if (!data || error) {
    throw new ProviderReplyError(
      `ارسال پاسخ به اینستاگرام ناموفق بود${error?.message ? `: ${error.message}` : ''}`
    )
  }
  return data
}

/** Public nested reply under the original comment. */
export async function sendCommentReply(
  accessToken: string,
  commentId: string,
  replyText: string
): Promise<void> {
  await graphPost(`${GRAPH_API}/${commentId}/replies`, {
    message: replyText,
    access_token: accessToken,
  })
}

/** Private reply (DM) to the commenter, addressed by comment_id. */
export async function sendPrivateReply(
  accessToken: string,
  igUserId: string,
  commentId: string,
  replyText: string
): Promise<void> {
  await graphPost(`${GRAPH_API}/${igUserId}/messages`, {
    recipient: { comment_id: commentId },
    message: { text: replyText },
    messaging_type: 'RESPONSE',
    access_token: accessToken,
  })
}
