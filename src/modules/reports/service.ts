/**
 * Issue #214: Exportable analytics reports — service.
 *
 * Business-logic layer. Validates inputs, calls the repository for data,
 * and exports to CSV (UTF-8 BOM) or PDF (printable HTML, RTL, Jalali dates,
 * Persian labels). The HTML is consumed by the API route as a string and
 * served with a Content-Disposition header so the browser downloads it.
 */

import { ReportsRepository } from './repository'
import { ValidationError, NoDataError } from './errors'
import { formatJalali } from '@/lib/jalali'
import type {
  AuthContext,
  ReportConfig,
  ReportData,
  ReportSeriesPoint,
  ReportTotals,
  ExportResult,
  ExportFormat,
  ReportMetric,
} from './types'

const METRIC_LABELS: Record<ReportMetric, string> = {
  reach: 'دسترسی',
  engagement: 'تعامل',
  followers: 'رشد مخاطبان',
  clicks: 'کلیک',
}

const CHANNEL_LABELS: Record<string, string> = {
  all: 'همه پلتفرم‌ها',
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  linkedin: 'لینکدین',
  rubika: 'روبیکا',
  bale: 'بله',
  eitaa: 'ایتا',
  null: 'همه پلتفرم‌ها',
}

export class ReportsService {
  constructor(private readonly repo: ReportsRepository = new ReportsRepository()) {}

  /** Validate the report config + return a normalized copy. */
  private validateConfig(config: ReportConfig): ReportConfig {
    if (!config.startDate || !config.endDate) {
      throw new ValidationError('بازه تاریخ الزامی است')
    }
    if (config.startDate > config.endDate) {
      throw new ValidationError('تاریخ شروع باید قبل از تاریخ پایان باشد')
    }
    if (!config.channels || config.channels.length === 0) {
      throw new ValidationError('حداقل یک پلتفرم باید انتخاب شود')
    }
    if (!config.metrics || config.metrics.length === 0) {
      throw new ValidationError('حداقل یک معیار باید انتخاب شود')
    }
    return config
  }

  /** Generate the report data (no export) — used by POST /api/reports. */
  async generateReport(auth: AuthContext, config: ReportConfig): Promise<ReportData> {
    const valid = this.validateConfig(config)
    const [snapshots, workspaceName] = await Promise.all([
      this.repo.findSnapshots(
        auth.workspaceId,
        valid.startDate,
        valid.endDate,
        valid.channels
      ),
      this.repo.getWorkspaceName(auth.workspaceId),
    ])

    if (snapshots.length === 0) {
      throw new NoDataError()
    }

    // Group by date, then build per-date value map keyed by `${channel}:${metric}`.
    const byDate = new Map<string, Map<string, number>>()
    for (const s of snapshots) {
      if (!byDate.has(s.date)) byDate.set(s.date, new Map())
      const dayMap = byDate.get(s.date)
      if (!dayMap) continue
      const channelKey = s.platform ?? 'all'
      // Skip metrics the user didn't ask for.
      if (!valid.metrics.includes(s.metricType as ReportMetric)) continue
      const key = `${channelKey}:${s.metricType}`
      const cur = dayMap.get(key) ?? 0
      dayMap.set(key, cur + s.value)
    }

    const dates = Array.from(byDate.keys()).sort()
    const series: ReportSeriesPoint[] = dates.map((date) => {
      const dayMap = byDate.get(date)
      return {
        date,
        jalaliDate: formatJalali(new Date(date)),
        values: dayMap ? Object.fromEntries(dayMap) : {},
      }
    })

    // Totals per metric (across the whole range, all selected channels).
    const totals: ReportTotals = {}
    for (const metric of valid.metrics) {
      let sum = 0
      for (const point of series) {
        for (const [key, value] of Object.entries(point.values)) {
          if (key.endsWith(`:${metric}`)) sum += value
        }
      }
      totals[metric] = sum
    }

    return {
      workspaceId: auth.workspaceId,
      workspaceName,
      config: valid,
      series,
      totals,
      generatedAt: new Date().toISOString(),
    }
  }

  /** Export the report data to CSV (UTF-8 BOM + Persian header row). */
  exportCSV(data: ReportData): ExportResult {
    const channels = data.config.channels
    const metrics = data.config.metrics
    // Header row: تاریخ | platform1:metric1 | platform1:metric2 | ...
    const headerCols: string[] = ['تاریخ']
    for (const ch of channels) {
      for (const m of metrics) {
        headerCols.push(`${CHANNEL_LABELS[ch] ?? ch}: ${METRIC_LABELS[m]}`)
      }
    }
    const rows: string[] = [headerCols.join(',')]
    for (const point of data.series) {
      const cols: string[] = [point.jalaliDate]
      for (const ch of channels) {
        for (const m of metrics) {
          const key = `${ch}:${m}`
          cols.push(String(point.values[key] ?? 0))
        }
      }
      rows.push(cols.join(','))
    }
    // Totals row.
    const totalsCols: string[] = ['جمع کل']
    for (const _ch of channels) {
      for (const m of metrics) {
        totalsCols.push(String(data.totals[m] ?? 0))
      }
    }
    rows.push(totalsCols.join(','))

    const csv = rows.join('\n')
    // UTF-8 BOM so Excel/Sheets render Persian correctly.
    const content = '\uFEFF' + csv
    return {
      format: 'csv',
      content,
      filename: `nashrino-report-${data.config.startDate}-${data.config.endDate}`,
      mimeType: 'text/csv; charset=utf-8',
    }
  }

  /** Export the report data to a printable HTML document (RTL, Jalali dates). */
  exportPDF(data: ReportData): ExportResult {
    const channels = data.config.channels
    const metrics = data.config.metrics
    const jalaliRange = `${formatJalali(new Date(data.config.startDate))} تا ${formatJalali(new Date(data.config.endDate))}`

    const headerCells = ['<th>تاریخ</th>']
    for (const ch of channels) {
      for (const m of metrics) {
        headerCells.push(
          `<th>${escapeHtml(CHANNEL_LABELS[ch] ?? ch)}<br><span class="metric">${escapeHtml(METRIC_LABELS[m])}</span></th>`
        )
      }
    }

    const bodyRows = data.series
      .map((point) => {
        const cells = [`<td>${escapeHtml(point.jalaliDate)}</td>`]
        for (const ch of channels) {
          for (const m of metrics) {
            const v = point.values[`${ch}:${m}`] ?? 0
            cells.push(`<td class="num">${v.toLocaleString('en-US')}</td>`)
          }
        }
        return `<tr>${cells.join('')}</tr>`
      })
      .join('')

    const totalsCells = ['<td><strong>جمع کل</strong></td>']
    for (const m of metrics) {
      const count = channels.length
      const total = data.totals[m] ?? 0
      totalsCells.push(`<td class="num" colspan="${count}"><strong>${total.toLocaleString('en-US')}</strong></td>`)
    }

    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>گزارش نشرینو — ${escapeHtml(data.workspaceName)}</title>
<style>
  @page { size: A4 landscape; margin: 16mm; }
  body { font-family: Vazirmatn, Tahoma, sans-serif; color: #1f2937; margin: 0; padding: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .meta { color: #6b7280; font-size: 13px; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { border: 1px solid #e5e7eb; padding: 8px 10px; text-align: right; }
  th { background: #f3f4f6; font-weight: 700; }
  th .metric { font-weight: 400; color: #6b7280; font-size: 11px; }
  td.num { font-variant-numeric: tabular-nums; text-align: left; direction: ltr; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals td { background: #f3f4f6 !important; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
  <h1>گزارش تحلیل نشرینو</h1>
  <div class="meta">
    فضای کار: ${escapeHtml(data.workspaceName)}<br>
    بازه: ${escapeHtml(jalaliRange)}<br>
    تولید شده در: ${escapeHtml(new Date(data.generatedAt).toLocaleString('fa-IR'))}
  </div>
  <table>
    <thead><tr>${headerCells.join('')}</tr></thead>
    <tbody>${bodyRows}</tbody>
    <tfoot><tr class="totals">${totalsCells.join('')}</tr></tfoot>
  </table>
</body>
</html>`

    return {
      format: 'pdf',
      content: html,
      filename: `nashrino-report-${data.config.startDate}-${data.config.endDate}`,
      mimeType: 'text/html; charset=utf-8',
    }
  }

  /** Convenience: generate + export in one call. */
  async exportReport(
    auth: AuthContext,
    format: ExportFormat,
    config: ReportConfig
  ): Promise<ExportResult> {
    const data = await this.generateReport(auth, config)
    return format === 'csv' ? this.exportCSV(data) : this.exportPDF(data)
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const reportsService = new ReportsService()
