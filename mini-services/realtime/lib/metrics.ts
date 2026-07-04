/**
 * Issue #126: Prometheus metrics for the realtime WebSocket service.
 *
 * Tracks active WebSocket connections so dashboards can show realtime
 * connection count. Exposed via the /metrics endpoint.
 */

import { Registry, Gauge } from 'prom-client'

export const realtimeRegistry = new Registry()

export const activeSocketsGauge = new Gauge({
  name: 'nashrino_active_sockets',
  help: 'Active WebSocket connections to the realtime service',
  registers: [realtimeRegistry],
})
