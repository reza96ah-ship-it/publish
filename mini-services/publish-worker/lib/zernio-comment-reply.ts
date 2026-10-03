/** At-most-once private replies for a Zernio-connected Instagram account. */
export async function sendZernioPrivateCommentReply(
  accountId: string,
  postId: string,
  commentId: string,
  message: string,
): Promise<{ messageId: string | null; recipientId: string | null }> {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('Zernio API key missing in worker')
  const response = await fetch(
    `https://zernio.com/api/v1/inbox/comments/${encodeURIComponent(postId)}/${encodeURIComponent(commentId)}/private-reply`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ accountId, message }),
      signal: AbortSignal.timeout(20_000),
    },
  )
  const payload: unknown = await response.json().catch(() => null)
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null
  if (!response.ok || body?.platform !== 'instagram') {
    throw new Error(`Zernio private reply not accepted (${response.status})`)
  }
  return { messageId: typeof body.messageId === 'string' ? body.messageId : null, recipientId: null }
}

export async function sendZernioPublicCommentReply(
  accountId: string,
  postId: string,
  commentId: string,
  message: string,
  idempotencyKey: string,
): Promise<{ id: string | null }> {
  const key = process.env.ZERNIO_API_KEY
  if (!key) throw new Error('Zernio API key missing in worker')
  const response = await fetch(`https://zernio.com/api/v1/inbox/comments/${encodeURIComponent(postId)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ accountId, message, commentId }),
    signal: AbortSignal.timeout(20_000),
  })
  const payload: unknown = await response.json().catch(() => null)
  const body = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null
  const data = body?.data && typeof body.data === 'object' && !Array.isArray(body.data) ? body.data as Record<string, unknown> : null
  if (!response.ok || body?.success !== true) throw new Error(`Zernio public reply not accepted (${response.status})`)
  return { id: typeof data?.commentId === 'string' ? data.commentId : null }
}
