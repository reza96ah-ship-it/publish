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

describe('Issue #157 — Performance budgets', () => {
  describe('route budgets', () => {
    it('defines budgets for all critical routes', () => {
      const requiredRoutes = [
        '/auth/signin', '/', '/compose', '/calendar', '/content',
        '/channels', '/analytics', '/settings', '/inbox', '/media', '/campaigns',
      ]
      for (const route of requiredRoutes) {
        expect(ROUTE_BUDGETS.find(b => b.route === route)).toBeDefined()
      }
    })

    it('compose has the highest JS budget (editor + media + AI)', () => {
      const compose = ROUTE_BUDGETS.find(b => b.route === '/compose')!
      const signin = ROUTE_BUDGETS.find(b => b.route === '/auth/signin')!
      expect(compose.maxJsKb).toBeGreaterThan(signin.maxJsKb)
    })

    it('all budgets are positive', () => {
      for (const b of ROUTE_BUDGETS) {
        expect(b.maxJsKb).toBeGreaterThan(0)
        expect(b.maxCssKb).toBeGreaterThan(0)
      }
    })
  })

  describe('API latency SLOs', () => {
    it('defines SLOs for critical endpoints', () => {
      expect(API_LATENCY_SLOS.length).toBeGreaterThanOrEqual(5)
      const publish = API_LATENCY_SLOS.find(s => s.endpoint === '/api/publish')!
      expect(publish.p95Ms).toBe(500)
    })

    it('health endpoint has the lowest latency target', () => {
      const health = API_LATENCY_SLOS.find(s => s.endpoint === '/api/health')!
      const publish = API_LATENCY_SLOS.find(s => s.endpoint === '/api/publish')!
      expect(health.p95Ms).toBeLessThan(publish.p95Ms)
    })
  })

  describe('resource ceilings', () => {
    it('defines ceilings for all services', () => {
      expect(RESOURCE_CEILINGS.app).toBeDefined()
      expect(RESOURCE_CEILINGS.worker).toBeDefined()
      expect(RESOURCE_CEILINGS.realtime).toBeDefined()
      expect(RESOURCE_CEILINGS.redis).toBeDefined()
      expect(RESOURCE_CEILINGS.postgres).toBeDefined()
    })
  })

  describe('Web Vitals budgets', () => {
    it('LCP budget is ≤ 2500ms', () => {
      expect(WEB_VITALS_BUDGETS.LCP_MS).toBeLessThanOrEqual(2500)
    })
    it('INP budget is ≤ 200ms', () => {
      expect(WEB_VITALS_BUDGETS.INP_MS).toBeLessThanOrEqual(200)
    })
    it('CLS budget is ≤ 0.1', () => {
      expect(WEB_VITALS_BUDGETS.CLS).toBeLessThanOrEqual(0.1)
    })
  })

  describe('schedule lateness budget', () => {
    it('p95 is ≤ 60 seconds', () => {
      expect(SCHEDULE_LATENESS_BUDGET.p95Seconds).toBeLessThanOrEqual(60)
    })
  })
})
