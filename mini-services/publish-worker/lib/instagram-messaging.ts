/**
 * Instagram Messaging API helpers for the comment→DM scanner.
 *
 * These are separate from the InstagramAdapter (which only handles content
 * publishing) because the Messaging + Comments API surfaces require different
 * permissions and are only used by the DM scanner, not the publish flow.
 *
 * Official docs:
 *   - Comments:  https://developers.facebook.com/docs/instagram-api/guides/comment-management
 *   - Messaging: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging
 *
 * Permissions required (in addition to instagram_basic + pages_show_list):
 *   - pages_read_engagement   (list comments)
 *   - instagram_manage_comments (reply to comments)
 *   - instagram_manage_messages (send private reply / DM)
 *
 * Auth: same long-lived access token as the publish adapter (Platform.tokenSecret).
 * The token must have the above scopes; otherwise the API returns a 403 which
 * the scanner surfaces as status='failed' in CommentDmLog.
 *
 * All functions use fetchWithTimeout for consistent timeout handling. Network
 * errors are thrown; the scanner catches them per-comment so one bad comment
 * doesn't abort the whole scan.
 */

import { fetchWithTimeout } from './fetch-with-timeout'

const IG_GRAPH_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v23.0'
const GRAPH_API = `https://graph.facebook.com/${IG_GRAPH_VERSION}`

/** A comment returned by the Instagram Comments API. */
export interface IgComment {
  id: string
  text: string
  username: string
  /** Instagram user ID of the commenter (may be absent for some edge cases). */
  from?: { id: string; username?: string }
  timestamp: string // ISO 8601
}

/**
 * Fetch recent comments on an Instagram media object.
 * Returns at most `limit` comments (default 50, IG max).
 * Caller is responsible for deduplication via CommentDmLog.
 *
 * @param accessToken Long-lived IG access token with pages_read_engagement
 * @param mediaId     IG media object ID (Publication.providerPostId)
 * @param limit       Max comments to fetch (1-50)
 */
export async function listComments(
  accessToken: string,
  mediaId: string,
  limit = 50
): Promise<IgComment[]> {
  const url =
    `${GRAPH_API}/${mediaId}/comments` +
    `?fields=id,text,username,from,timestamp&limit=${limit}&access_token=${accessToken}`
  const res = await fetchWithTimeout(url)
  const data = await res.json()
  if (data.error) {
    throw new Error(`IG comments list failed: ${data.error.message ?? 'unknown error'}`)
  }
  return (data.data ?? []) as IgComment[]
}

/**
 * Send a private reply (DM) to a commenter via the Instagram Messaging API.
 *
 * Uses the comment_id recipient form — this is the only way to DM someone who
 * commented on your post without them first messaging you (7-day window).
 *
 * @param accessToken  Long-lived IG access token with instagram_manage_messages
 * @param igUserId     The IG Business/Creator account ID (Platform.targetId)
 * @param commentId    The ID of the comment to reply to (IgComment.id)
 * @param messageText  The DM body (already template-rendered)
 */
export async function sendDmForComment(
  accessToken: string,
  igUserId: string,
  commentId: string,
  messageText: string
): Promise<{ messageId: string | null; recipientId: string | null }> {
  const res = await fetchWithTimeout(`${GRAPH_API}/${igUserId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { comment_id: commentId },
      message: { text: messageText },
      // messaging_type=RESPONSE is required when replying within 7-day window
      messaging_type: 'RESPONSE',
      access_token: accessToken,
    }),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(`IG DM send failed: ${data.error.message ?? 'unknown error'}`)
  }
  return {
    messageId: data.message_id ?? null,
    recipientId: data.recipient?.id ?? null,
  }
}

/**
 * Post a public reply to a comment (appears nested under the original comment).
 *
 * @param accessToken  Long-lived IG access token with instagram_manage_comments
 * @param commentId    The ID of the comment to reply to
 * @param replyText    The public reply text
 */
export async function replyToComment(
  accessToken: string,
  commentId: string,
  replyText: string
): Promise<{ id: string | null }> {
  const res = await fetchWithTimeout(`${GRAPH_API}/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: replyText,
      access_token: accessToken,
    }),
  })
  const data = await res.json()
  if (data.error) {
    throw new Error(`IG comment reply failed: ${data.error.message ?? 'unknown error'}`)
  }
  return { id: data.id ?? null }
}
