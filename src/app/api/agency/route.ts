/**
 * Issue #254: Agency API — profile GET + setup POST + PATCH update.
 *
 *   GET    /api/agency   — get the agency profile for the active workspace
 *   POST   /api/agency   — set up (create) the agency profile (idempotent)
 *   PATCH  /api/agency   — update white-label settings + client list
 *
 * All require `workspace.settings` (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, agencyProfileSchema } from '@/lib/validations'
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
      await agencyService.getProfile({ workspaceId: guard.workspaceId, userId: guard.userId })
    )
  } catch (err) { return mapError(err) }
}

export async function POST() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    return NextResponse.json(
      await agencyService.setupAgency({ workspaceId: guard.workspaceId, userId: guard.userId }),
      { status: 201 }
    )
  } catch (err) { return mapError(err) }
}

export async function PATCH(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(agencyProfileSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    return NextResponse.json(
      await agencyService.updateProfile(
        { workspaceId: guard.workspaceId, userId: guard.userId },
        v.data
      )
    )
  } catch (err) { return mapError(err) }
}
