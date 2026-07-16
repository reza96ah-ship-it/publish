/**
 * Client-side telemetry bridge (plan §18).
 *
 * Sends an event to /api/track which forwards it to PostHog server-side.
 * Fire-and-forget — never blocks user interactions or throws to callers.
 * keepalive: true ensures the request survives navigation/unload.
 */
export function trackClient(event: string, properties?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  void fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, ...properties }),
    keepalive: true,
  }).catch(() => {})
}
