export interface HealthResult {
  ok: true
  status: 'alive'
  uptime: number
  timestamp: string
  version: string
  environment: string
}

export interface ReadinessCheck {
  ok: boolean
  latencyMs?: number
  error?: string
}

export interface ReadyResult {
  ok: boolean
  status: 'ready' | 'not_ready'
  checks: Record<string, ReadinessCheck>
  timestamp: string
}

export interface ReadyResponse {
  result: ReadyResult
  statusCode: 200 | 503
}
