/**
 * Emits job status events to the realtime WebSocket service.
 * The worker calls this after every job state transition so the
 * frontend's Publishing Pulse updates in real time.
 */
import { REALTIME_EMIT_URL } from './db'

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
    await fetch(REALTIME_EMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(evt),
    })
  } catch (err) {
    // Non-fatal: the realtime service may be down; the UI will still
    // refresh via polling. Log and continue.
    console.warn('[emit] realtime service unreachable:', (err as Error).message)
  }
}
