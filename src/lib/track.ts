/**
 * Nashrino event tracking — server-side only.
 *
 * Sends events to PostHog if POSTHOG_KEY is set; otherwise no-ops silently
 * so development/staging environments don't require an analytics key.
 *
 * Usage (in API routes / server actions):
 *   await track({ event: 'publication_queued', workspaceId, jobId, platformType, scheduleType: 'now' })
 *
 * Client-side tracking is intentionally NOT supported — all events route
 * through the server so we control what PII is captured.
 */

import type { NashrinoEvent } from './events'

const POSTHOG_KEY = process.env.POSTHOG_KEY ?? ''
const POSTHOG_HOST = process.env.POSTHOG_HOST ?? 'https://eu.posthog.com'

interface PostHogCapture {
  api_key: string
  event: string
  distinct_id: string
  properties: Record<string, unknown>
  timestamp?: string
}

async function posthogCapture(payload: PostHogCapture) {
  if (!POSTHOG_KEY) return
  try {
    await fetch(`${POSTHOG_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    })
  } catch {
    // Analytics must never break the critical path — log and move on.
    // Errors here are acceptable in degraded network conditions.
  }
}

/**
 * track() — fire-and-forget product event.
 *
 * Await it in background with `void track(...)` or `track(...).catch(() => {})`.
 * Never block a user-facing response on analytics.
 */
export async function track(event: NashrinoEvent): Promise<void> {
  const { workspaceId, userId, timestamp, ...props } = event as NashrinoEvent & {
    event: string
    workspaceId: string
    userId?: string
    timestamp?: string
  }

  // Use workspace-scoped ID as the distinct_id to avoid user PII in the key
  const distinctId = userId ? `ws:${workspaceId}:u:${userId}` : `ws:${workspaceId}`

  await posthogCapture({
    api_key: POSTHOG_KEY,
    event: (event as { event: string }).event,
    distinct_id: distinctId,
    properties: {
      ...props,
      workspaceId,
      $lib: 'nashrino-server',
    },
    timestamp: timestamp ?? new Date().toISOString(),
  })
}
