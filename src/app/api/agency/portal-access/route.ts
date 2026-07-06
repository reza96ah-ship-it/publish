/**
 * Issue #254: Agency API — client portal access tokens list + create.
 *
 *   GET   /api/agency/portal-access  — list portal-access tokens for all clients
 *   POST  /api/agency/portal-access  — create a new token for a client workspace
 *
 * Both require `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, portalAccessCreateSchema } from '@/lib/validations'
import { agencyService, AgencyError } from '@/modules/agency'

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
      await agencyService.listPortalAccess({
        workspaceId: guard.workspaceId,
        userId: guard.userId,
      })
    )
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(portalAccessCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const expiresAt = v.data.expiresAt ? new Date(v.data.expiresAt) : null
    return NextResponse.json(
      await agencyService.createPortalAccess(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        v.data.workspaceId,
        v.data.permissions,
        expiresAt
      ),
      { status: 201 }
    )
  } catch (err) { return mapError(err) }
}
