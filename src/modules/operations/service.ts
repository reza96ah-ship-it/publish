import { db } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { HealthResult, ReadyResponse } from './types'

export class OperationsService {
  // Captured once at module load — same semantics as the previous route-level const.
  private readonly startTime = Date.now()

  liveness(): HealthResult {
    const uptime = Math.floor((Date.now() - this.startTime) / 1000)
    logger.debug({ msg: 'health check', uptime })
    return {
      ok: true,
      status: 'alive',
      uptime,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
      environment: process.env.NODE_ENV ?? 'development',
    }
  }

  async readiness(): Promise<ReadyResponse> {
    const checks: ReadyResponse['result']['checks'] = {}

    try {
      const start = Date.now()
      await db.$queryRaw`SELECT 1`
      checks.database = { ok: true, latencyMs: Date.now() - start }
    } catch (err) {
      checks.database = { ok: false, error: err instanceof Error ? err.message : 'unknown' }
      logger.error({ msg: 'readiness check: database unreachable', error: err })
    }

    const allOk = Object.values(checks).every((c) => c.ok)
    return {
      result: {
        ok: allOk,
        status: allOk ? 'ready' : 'not_ready',
        checks,
        timestamp: new Date().toISOString(),
      },
      statusCode: allOk ? 200 : 503,
    }
  }
}

export const operationsService = new OperationsService()
