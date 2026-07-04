/**
 * Issue #200: Dashboard domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point: `import { dashboardService } from '@/modules/dashboard'`
 */

export { DashboardService, dashboardService } from './service'
export type { ActionCenterResult, PulseItem } from './service'
