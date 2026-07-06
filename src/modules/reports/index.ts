/**
 * Issue #214: Exportable analytics reports — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { reportsService, ReportError } from '@/modules/reports'
 */

export { ReportsService, reportsService } from './service'
export { ReportsRepository } from './repository'
export type {
  AuthContext,
  ReportConfig,
  ReportData,
  ReportSeriesPoint,
  ReportTotals,
  ExportResult,
  ExportFormat,
  ReportMetric,
  ReportChannel,
} from './types'
export { ReportError, ValidationError, NoDataError } from './errors'
