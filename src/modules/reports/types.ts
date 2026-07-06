/**
 * Issue #214: Exportable analytics reports — types.
 *
 * Pure domain types shared between route handler, service, and repository.
 * No imports from Prisma or Next.js here.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export type ReportMetric = 'reach' | 'engagement' | 'followers' | 'clicks'
export type ReportChannel = 'all' | 'instagram' | 'telegram' | 'linkedin' | 'rubika' | 'bale' | 'eitaa'
export type ExportFormat = 'csv' | 'pdf'

export interface ReportConfig {
  /** ISO date strings (YYYY-MM-DD). The repository filters snapshots by `date` between these. */
  startDate: string
  endDate: string
  channels: ReportChannel[]
  metrics: ReportMetric[]
}

export interface ReportSeriesPoint {
  date: string
  /** Jalali-formatted date for display. */
  jalaliDate: string
  /** Per-channel metric values keyed by `${channel}:${metric}`. */
  values: Record<string, number>
}

export interface ReportTotals {
  /** Per-metric totals across the whole date range. */
  [metric: string]: number
}

export interface ReportData {
  workspaceId: string
  workspaceName: string
  config: ReportConfig
  series: ReportSeriesPoint[]
  totals: ReportTotals
  generatedAt: string
}

export interface ExportResult {
  format: ExportFormat
  /** For CSV: UTF-8 BOM + CSV string. For PDF: full HTML document (RTL). */
  content: string
  /** Suggested filename for the download (without extension). */
  filename: string
  /** MIME type for the response. */
  mimeType: string
}
