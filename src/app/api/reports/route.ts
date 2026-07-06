/**
 * Issue #214: Exportable analytics reports API.
 *
 *   POST /api/reports        — generate report data (returns JSON).
 *   POST /api/reports/export — export report (returns CSV or printable HTML).
 *
 * Body: { config: { startDate, endDate, channels, metrics }, format? }
 *
 * Permission: analytics.view (admin + editor + approver) — same as the
 * existing /api/analytics route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { reportsService, ReportError } from '@/modules/reports'
import type { ReportConfig, ReportChannel, ReportMetric } from '@/modules/reports'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof ReportError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

const reportConfigSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ شروع معتبر نیست'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'تاریخ پایان معتبر نیست'),
  channels: z.array(z.string().min(1).max(20)).min(1, 'حداقل یک پلتفرم الزامی است'),
  metrics: z.array(z.enum(['reach', 'engagement', 'followers', 'clicks'])).min(1, 'حداقل یک معیار الزامی است'),
})

const generateSchema = z.object({ config: reportConfigSchema })

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(generateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const config: ReportConfig = {
      startDate: v.data.config.startDate,
      endDate: v.data.config.endDate,
      channels: v.data.config.channels as ReportChannel[],
      metrics: v.data.config.metrics as ReportMetric[],
    }
    const data = await reportsService.generateReport(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      config
    )
    return NextResponse.json(data)
  } catch (err) { return mapError(err) }
}
