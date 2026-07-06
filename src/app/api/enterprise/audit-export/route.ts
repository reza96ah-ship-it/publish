/**
 * Issue #256: Enterprise audit-log export API.
 *
 *   POST /api/enterprise/audit-export   — export audit logs as JSON or CSV
 *
 * Body: AuditExportConfig (format, date range, action filter, userId filter, limit).
 * CSV responses get a Content-Disposition: attachment header so the browser
 * downloads the file. Permission: workspace.settings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, auditExportSchema } from '@/lib/validations'
import { enterpriseService, EnterpriseError } from '@/modules/enterprise'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(auditExportSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const result = await enterpriseService.exportAuditLogs(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      {
        format: v.data.format,
        limit: v.data.limit,
        startDate: v.data.startDate ? new Date(v.data.startDate) : undefined,
        endDate: v.data.endDate ? new Date(v.data.endDate) : undefined,
        action: v.data.action,
        userId: v.data.userId,
      }
    )
    if (result.format === 'csv') {
      return new NextResponse(result.data as string, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="audit-${Date.now()}.csv"`,
        },
      })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    if (err instanceof EnterpriseError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
