/**
 * Emits job status events to the realtime WebSocket service.
 * The worker calls this after every job state transition so the
 * frontend's Publishing Pulse updates in real time.
 *
 * P7.3: sends X-Emit-Secret header for authentication.
 */
import { REALTIME_EMIT_URL } from './db'

const EMIT_SECRET = process.env.EMIT_SECRET || 'nashrino-dev-emit-secret'

export interface JobStatusEvent {
  workspaceId: string
  event: 'job:status' | 'job:progress'
  payload: {
    jobId: string
    status: string
    progress: number
    processLabel: string
    error: string | null
    platform: string
    externalId: string | null
  }
}

export async function emitJobStatus(evt: JobStatusEvent): Promise<void> {
  try {
    const res = await fetch(REALTIME_EMIT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Emit-Secret': EMIT_SECRET, // P7.3: authenticate worker → realtime
      },
      body: JSON.stringify(evt),
      signal: AbortSignal.timeout(5_000), // don't block worker if realtime is slow
    })
    if (!res.ok && res.status === 401) {
      console.error('[emit] 401 — EMIT_SECRET mismatch between worker and realtime')
    }
  } catch (err) {
    // Non-fatal: the realtime service may be down; the UI will still
    // refresh via polling. Log and continue.
    console.warn('[emit] realtime service unreachable:', (err as Error).message)
  }
}
