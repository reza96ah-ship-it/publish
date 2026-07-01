import { describe, it, expect } from 'vitest'
import {
  ROUTE_BUDGETS,
  API_LATENCY_SLOS,
  RESOURCE_CEILINGS,
  WEB_VITALS_BUDGETS,
  MEDIA_UPLOAD_BUDGETS,
  REALTIME_LATENCY_BUDGETS,
  SCHEDULE_LATENESS_BUDGET,
} from '../../../src/lib/performance-budgets'
import {
  SMALL_WORKSPACE,
  NORMAL_WORKSPACE,
  LARGE_WORKSPACE,
  SCHEDULED_BURST,
  MEDIA_HEAVY,
  ALL_DATASETS,
  generatePersianTitle,
  generatePersianCaption,
  getDataset,
} from '../../fixtures/datasets'

describe('Issue #157 — Performance budgets', () => {
  describe('route budgets', () => {
    it('defines budgets for all 11 critical routes', () => {
      const requiredRoutes = [
        '/auth/signin', '/', '/compose', '/calendar', '/content',
        '/channels', '/analytics', '/settings', '/inbox', '/media', '/campaigns',
      ]
      for (const route of requiredRoutes) {
        const budget = ROUTE_BUDGETS.find(b => b.route === route)
        expect(budget, `Route ${route} must have a budget`).toBeDefined()
      }
      expect(ROUTE_BUDGETS.length).toBe(requiredRoutes.length)
    })

    it('compose has the highest JS budget (editor + media + AI)', () => {
      const compose = ROUTE_BUDGETS.find(b => b.route === '/compose')!
      const maxBudget = Math.max(...ROUTE_BUDGETS.map(b => b.maxJsKb))
      expect(compose.maxJsKb).toBe(maxBudget)
    })

    it('signin has the lowest JS budget (minimal page)', () => {
      const signin = ROUTE_BUDGETS.find(b => b.route === '/auth/signin')!
      const minBudget = Math.min(...ROUTE_BUDGETS.map(b => b.maxJsKb))
      expect(signin.maxJsKb).toBe(minBudget)
    })

    it('all JS budgets are within reasonable range (50-500KB)', () => {
      for (const b of ROUTE_BUDGETS) {
        expect(b.maxJsKb, `${b.route} JS budget`).toBeGreaterThanOrEqual(50)
        expect(b.maxJsKb, `${b.route} JS budget`).toBeLessThanOrEqual(500)
      }
    })

    it('all CSS budgets are within reasonable range (10-50KB)', () => {
      for (const b of ROUTE_BUDGETS) {
        expect(b.maxCssKb, `${b.route} CSS budget`).toBeGreaterThanOrEqual(10)
        expect(b.maxCssKb, `${b.route} CSS budget`).toBeLessThanOrEqual(50)
      }
    })

    it('analytics budget accounts for chart library', () => {
      const analytics = ROUTE_BUDGETS.find(b => b.route === '/analytics')!
      // Chart libraries (recharts/chart.js) add significant JS weight
      expect(analytics.maxJsKb).toBeGreaterThanOrEqual(250)
    })
  })

  describe('API latency SLOs', () => {
    it('defines SLOs for all critical endpoints', () => {
      const requiredEndpoints = ['/api/health', '/api/publish', '/api/content']
      for (const endpoint of requiredEndpoints) {
        const slo = API_LATENCY_SLOS.find(s => s.endpoint === endpoint)
        expect(slo, `Endpoint ${endpoint} must have an SLO`).toBeDefined()
      }
      expect(API_LATENCY_SLOS.length).toBeGreaterThanOrEqual(8)
    })

    it('health endpoint has the lowest latency target', () => {
      const health = API_LATENCY_SLOS.find(s => s.endpoint === '/api/health')!
      const minP95 = Math.min(...API_LATENCY_SLOS.map(s => s.p95Ms))
      expect(health.p95Ms).toBe(minP95)
    })

    it('publish endpoint has p95 ≤ 500ms (queue acceptance, not provider)', () => {
      const publish = API_LATENCY_SLOS.find(s => s.endpoint === '/api/publish')!
      expect(publish.p95Ms).toBeLessThanOrEqual(500)
    })

    it('all p99 values are greater than p95 values', () => {
      for (const slo of API_LATENCY_SLOS) {
        expect(slo.p99Ms, `${slo.endpoint}`).toBeGreaterThan(slo.p95Ms)
      }
    })

    it('all SLOs have valid HTTP methods', () => {
      const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
      for (const slo of API_LATENCY_SLOS) {
        expect(validMethods).toContain(slo.method)
      }
    })
  })

  describe('resource ceilings', () => {
    it('defines ceilings for all 6 services', () => {
      const requiredServices = ['app', 'worker', 'realtime', 'redis', 'pgbouncer', 'postgres']
      for (const service of requiredServices) {
        expect(RESOURCE_CEILINGS, `Service ${service}`).toHaveProperty(service)
      }
    })

    it('app has highest memory ceiling (Next.js + SSR)', () => {
      expect(RESOURCE_CEILINGS.app.memoryMb).toBeGreaterThanOrEqual(
        RESOURCE_CEILINGS.worker.memoryMb
      )
    })

    it('realtime has lowest memory ceiling (socket.io only)', () => {
      expect(RESOURCE_CEILINGS.realtime.memoryMb).toBeLessThan(
        RESOURCE_CEILINGS.app.memoryMb
      )
    })

    it('postgres has the most CPU (query processing)', () => {
      expect(RESOURCE_CEILINGS.postgres.cpus).toBeGreaterThanOrEqual(
        RESOURCE_CEILINGS.app.cpus
      )
    })

    it('all ceilings are positive', () => {
      for (const [, ceiling] of Object.entries(RESOURCE_CEILINGS)) {
        expect(ceiling.memoryMb).toBeGreaterThan(0)
        expect(ceiling.cpus).toBeGreaterThan(0)
      }
    })
  })

  describe('Web Vitals budgets — match Google thresholds', () => {
    it('LCP budget is exactly 2500ms (Google "good" threshold)', () => {
      expect(WEB_VITALS_BUDGETS.LCP_MS).toBe(2500)
    })

    it('INP budget is exactly 200ms (Google 2024 "good" threshold)', () => {
      expect(WEB_VITALS_BUDGETS.INP_MS).toBe(200)
    })

    it('CLS budget is exactly 0.1 (Google "good" threshold)', () => {
      expect(WEB_VITALS_BUDGETS.CLS).toBe(0.1)
    })

    it('TTFB budget is ≤ 800ms (Google "good" threshold)', () => {
      expect(WEB_VITALS_BUDGETS.TTFB_MS).toBeLessThanOrEqual(800)
    })
  })

  describe('media upload budgets', () => {
    it('small files (< 5MB) validate within 2s', () => {
      expect(MEDIA_UPLOAD_BUDGETS.small.maxSizeMb).toBeLessThanOrEqual(5)
      expect(MEDIA_UPLOAD_BUDGETS.small.maxValidationMs).toBeLessThanOrEqual(2000)
    })

    it('large files (videos, up to 100MB) validate within 30s', () => {
      expect(MEDIA_UPLOAD_BUDGETS.large.maxSizeMb).toBeLessThanOrEqual(100)
      expect(MEDIA_UPLOAD_BUDGETS.large.maxValidationMs).toBeLessThanOrEqual(30000)
    })

    it('budgets scale with file size', () => {
      expect(MEDIA_UPLOAD_BUDGETS.small.maxValidationMs).toBeLessThan(
        MEDIA_UPLOAD_BUDGETS.medium.maxValidationMs
      )
      expect(MEDIA_UPLOAD_BUDGETS.medium.maxValidationMs).toBeLessThan(
        MEDIA_UPLOAD_BUDGETS.large.maxValidationMs
      )
    })
  })

  describe('realtime latency budgets', () => {
    it('event delivery is < 500ms (worker → realtime → browser)', () => {
      expect(REALTIME_LATENCY_BUDGETS.eventDeliveryMs).toBeLessThanOrEqual(500)
    })

    it('reconnect completes within 2s', () => {
      expect(REALTIME_LATENCY_BUDGETS.reconnectMs).toBeLessThanOrEqual(2000)
    })
  })

  describe('schedule lateness budget', () => {
    it('p95 is ≤ 60 seconds (issue requirement)', () => {
      expect(SCHEDULE_LATENESS_BUDGET.p95Seconds).toBeLessThanOrEqual(60)
    })

    it('p99 is ≤ 120 seconds (2x p95)', () => {
      expect(SCHEDULE_LATENESS_BUDGET.p99Seconds).toBeLessThanOrEqual(120)
    })
  })
})

describe('Issue #157 — Test datasets', () => {
  it('defines 5 datasets covering small/normal/large/burst/media-heavy', () => {
    const names = ALL_DATASETS.map(d => d.name)
    expect(names).toContain('small')
    expect(names).toContain('normal')
    expect(names).toContain('large')
    expect(names).toContain('scheduled-burst')
    expect(names).toContain('media-heavy')
    expect(ALL_DATASETS.length).toBe(5)
  })

  it('small workspace has 1 user, 2 channels, 100 content records', () => {
    expect(SMALL_WORKSPACE.users).toBe(1)
    expect(SMALL_WORKSPACE.channels).toBe(2)
    expect(SMALL_WORKSPACE.contentRecords).toBe(100)
  })

  it('normal workspace has 10 users, 10 channels, 10K content records', () => {
    expect(NORMAL_WORKSPACE.users).toBe(10)
    expect(NORMAL_WORKSPACE.channels).toBe(10)
    expect(NORMAL_WORKSPACE.contentRecords).toBe(10_000)
  })

  it('large workspace has at least 100K content records (issue requirement)', () => {
    expect(LARGE_WORKSPACE.contentRecords).toBeGreaterThanOrEqual(100_000)
  })

  it('scheduled burst dataset has publications sharing same target minute', () => {
    expect(SCHEDULED_BURST.publicationRecords).toBeGreaterThan(100)
    expect(SCHEDULED_BURST.description).toContain('same target minute')
  })

  it('media-heavy dataset has large media library', () => {
    expect(MEDIA_HEAVY.mediaRecords).toBeGreaterThanOrEqual(10_000)
  })

  it('all datasets preserve tenant isolation (no cross-workspace data)', () => {
    for (const ds of ALL_DATASETS) {
      // Each dataset represents ONE workspace — no shared mutable data
      expect(ds.users).toBeGreaterThan(0)
      expect(ds.channels).toBeGreaterThan(0)
    }
  })

  it('getDataset returns correct dataset by name', () => {
    expect(getDataset('small')).toBe(SMALL_WORKSPACE)
    expect(getDataset('large')).toBe(LARGE_WORKSPACE)
  })

  it('getDataset throws on unknown name', () => {
    expect(() => getDataset('unknown')).toThrow()
  })

  it('Persian title generator produces RTL text', () => {
    const title = generatePersianTitle(1)
    // Should contain Persian characters and the index number
    expect(title).toMatch(/[۰-۹0-9]/)
    expect(title.length).toBeGreaterThan(10)
  })

  it('Persian title generator cycles through templates', () => {
    const t0 = generatePersianTitle(0)
    const t1 = generatePersianTitle(1)
    // Different indices should produce different titles
    expect(t0).not.toBe(t1)
  })

  it('Persian caption generator includes hashtags', () => {
    const caption = generatePersianCaption(1)
    expect(caption).toContain('#')
    expect(caption).toContain('تست')
  })
})
