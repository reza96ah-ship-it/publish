/**
 * Inbox realtime emitter — pushes thread events to the realtime socket
 * service so open inboxes update live instead of waiting for a manual
 * refresh. Same transport the publish-worker uses for job status
 * (POST /emit + X-Emit-Secret), see mini-services/realtime/index.ts.
 *
 * Fire-and-forget: a slow or down realtime service must never delay or fail
 * webhook ingestion or a reply request — errors are logged and swallowed.
 */

const REALTIME_EMIT_URL = process.env.REALTIME_EMIT_URL || 'http://localhost:3003/emit'
const EMIT_SECRET = process.env.EMIT_SECRET || 'nashrino-dev-emit-secret'

export interface InboxThreadEvent {
  threadId: string
  /** created = new thread, message = new inbound message, updated = reply/status change */
  kind: 'created' | 'message' | 'updated'
  messageType: string
  senderName?: string
  preview?: string
}

export async function emitInboxThreadEvent(
  workspaceId: string,
  payload: InboxThreadEvent
): Promise<void> {
  try {
    const res = await fetch(REALTIME_EMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emit-Secret': EMIT_SECRET,
      },
      body: JSON.stringify({ workspaceId, event: 'inbox:thread', payload }),
      signal: AbortSignal.timeout(3_000),
    })
    if (!res.ok && res.status === 401) {
      console.error('[inbox-emit] 401 — EMIT_SECRET mismatch between app and realtime')
    }
  } catch (err) {
    console.error('[inbox-emit] emit failed (non-fatal):', (err as Error).message)
  }
}
