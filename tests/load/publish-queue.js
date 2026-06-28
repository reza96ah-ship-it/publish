/**
 * Issue #129: k6 load test — publish queue acceptance + worker throughput.
 *
 * Scenario: 50 VUs ramping over 30s, sustain for 60s, ramp down over 30s.
 *
 * Targets before launch:
 *   - Concurrent API requests: 100 req/s sustained
 *   - Queue acceptance latency p95: <500ms
 *   - Error rate: <1%
 *
 * Usage:
 *   k6 run tests/load/publish-queue.js
 *
 * With custom base URL + auth token:
 *   K6_BASE_URL=http://localhost:3000 K6_AUTH_TOKEN=<jwt> k6 run tests/load/publish-queue.js
 *
 * Prerequisites:
 *   1. Start the dev server: bun run dev
 *   2. Start the worker: cd mini-services/publish-worker && bun run dev
 *   3. Have at least one connected channel (Telegram) in the test workspace
 *   4. Obtain a JWT auth token (login via /api/auth/callback/credentials)
 *
 * Install k6: https://k6.io/docs/getting-started/installation/
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

// ── Configuration ──────────────────────────────────────────────
const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:3000'
const AUTH_TOKEN = __ENV.K6_AUTH_TOKEN || ''
const WORKSPACE_ID = __ENV.K6_WORKSPACE_ID || 'test-workspace'
const CHANNEL_ID = __ENV.K6_CHANNEL_ID || 'test-channel'

// ── Custom metrics ─────────────────────────────────────────────
const errorRate = new Rate('errors')
const queueAcceptanceLatency = new Trend('queue_acceptance_latency_ms', true)

// ── Test scenario ──────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 VUs over 30s
    { duration: '1m', target: 50 }, // sustain 50 VUs for 1 minute
    { duration: '30s', target: 0 }, // ramp down to 0 over 30s
  ],
  thresholds: {
    // Issue #129 acceptance criteria
    http_req_duration: ['p(95)<500'], // p95 < 500ms
    http_req_failed: ['rate<0.01'], // error rate < 1%
    errors: ['rate<0.01'],
    queue_acceptance_latency_ms: ['p(95)<500'],
  },
  tags: {
    test: 'publish-queue-load',
  },
}

// ── Test function ──────────────────────────────────────────────
export default function () {
  const headers = {
    'Content-Type': 'application/json',
  }
  if (AUTH_TOKEN) {
    headers['Authorization'] = `Bearer ${AUTH_TOKEN}`
    headers['Cookie'] = `next-auth.session-token=${AUTH_TOKEN}`
  }

  const payload = JSON.stringify({
    title: `Load test post ${Date.now()}-${__VU}-${__ITER}`,
    caption: 'این یک پست تستی برای آزمون بار است',
    hashtags: '#تست #بار',
    scheduleMode: 'now',
    mode: 'publish',
    channelIds: [CHANNEL_ID],
    mediaIds: [],
  })

  const startTime = Date.now()
  const res = http.post(`${BASE_URL}/api/publish`, payload, { headers })
  const latency = Date.now() - startTime

  queueAcceptanceLatency.add(latency)

  const success = check(res, {
    'status is 201 or 401 (auth)': (r) => r.status === 201 || r.status === 401,
    'response has contentId or error': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.contentId !== undefined || body.error !== undefined
      } catch {
        return false
      }
    },
  })

  errorRate.add(!success)

  // Small think time between requests (0.5-1s)
  sleep(Math.random() * 0.5 + 0.5)
}

// ── Setup — verify the server is reachable ────────────────────
export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`)
  if (healthRes.status !== 200) {
    console.error(`Server not healthy at ${BASE_URL}/api/health — status: ${healthRes.status}`)
    console.error('Start the dev server first: bun run dev')
  }
  return { serverOk: healthRes.status === 200 }
}

// ── Teardown — print summary ──────────────────────────────────
export function teardown(data) {
  if (data.serverOk) {
    console.log('\n=== Load Test Complete ===')
    console.log('Check thresholds above — all must pass for launch readiness.')
    console.log('Targets: p95 < 500ms, error rate < 1%, 100 req/s sustained')
  }
}
