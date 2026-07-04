/**
 * k6 smoke test — liveness + readiness under minimal load.
 *
 * Targets: /api/health (process alive, no DB) and /api/readyz (DB SELECT 1).
 * Runs 3 VUs for 30 seconds. Thresholds are set conservatively so any real
 * regression (DB hang, routing break, OOM) fails the gate.
 *
 * Run locally:
 *   k6 run k6/smoke.js
 * Override base URL:
 *   BASE_URL=https://staging.example.com k6 run k6/smoke.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 3,
      duration: '30s',
    },
  },
  thresholds: {
    // Overall error rate — any non-2xx is a gate failure
    http_req_failed: ['rate<0.01'],
    // Liveness endpoint — pure process overhead, no I/O
    'http_req_duration{endpoint:health}': ['p(95)<300'],
    // Readiness endpoint — includes one DB round-trip (SELECT 1)
    'http_req_duration{endpoint:readyz}': ['p(95)<800'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000'

export default function () {
  const health = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: 'health' },
    timeout: '5s',
  })
  check(health, {
    'health: status 200': (r) => r.status === 200,
    'health: ok=true': (r) => {
      try {
        return JSON.parse(r.body).ok === true
      } catch {
        return false
      }
    },
  })

  const readyz = http.get(`${BASE_URL}/api/readyz`, {
    tags: { endpoint: 'readyz' },
    timeout: '5s',
  })
  check(readyz, {
    'readyz: status 200': (r) => r.status === 200,
    'readyz: database ok': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.ok === true && body.checks?.database?.ok === true
      } catch {
        return false
      }
    },
  })

  sleep(1)
}
