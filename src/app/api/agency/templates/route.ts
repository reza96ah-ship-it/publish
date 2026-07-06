/**
 * Issue #254: Agency API — workspace templates list + create.
 *
 *   GET   /api/agency/templates  — list templates for the active workspace
 *   POST  /api/agency/templates  — create a new template
 *
 * Requires `workspace.settings`. POST also supports an optional `createClient`
 * shape — if `clientName` is provided alongside `templateId`, the route creates
 * a new client workspace from the template instead. (Kept here so the UI can
 * hit a single endpoint; the service routes to createClientFromTemplate.)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, templateCreateSchema, persianText } from '@/lib/validations'
import { agencyService, AgencyError } from '@/modules/agency'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof AgencyError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    return NextResponse.json(
      await agencyService.listTemplates({ workspaceId: guard.workspaceId, userId: guard.userId })
    )
  } catch (err) { return mapError(err) }
}

const createClientSchema = z.object({
  templateId: z.string().min(1, 'شناسه قالب الزامی است').max(100),
  clientName: persianText(1, 100, 'نام مشتری الزامی است'),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })

  // Branch: create-client-from-template vs create-template.
  if (typeof raw === 'object' && raw !== null && 'templateId' in raw && 'clientName' in raw) {
    const v = validateBody(createClientSchema, raw)
    if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
    try {
      return NextResponse.json(
        await agencyService.createClientFromTemplate(
          { workspaceId: guard.workspaceId, userId: guard.userId },
          v.data.templateId,
          v.data.clientName
        ),
        { status: 201 }
      )
    } catch (err) { return mapError(err) }
  }

  const v = validateBody(templateCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    return NextResponse.json(
      await agencyService.createTemplate(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        v.data
      ),
      { status: 201 }
    )
  } catch (err) { return mapError(err) }
}
