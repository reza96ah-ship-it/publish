/**
 * Issue #256: Enterprise SSO API — list + create.
 *
 *   GET    /api/enterprise/sso   — list SSO configs for the active workspace
 *   POST   /api/enterprise/sso   — register a new SSO provider (SAML / OIDC)
 *
 * Permission: workspace.settings (admin-only — security-sensitive).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, ssoConfigCreateSchema } from '@/lib/validations'
import { enterpriseService, EnterpriseError } from '@/modules/enterprise'

export const dynamic = 'force-dynamic'

function mapError(err: unknown): NextResponse {
  if (err instanceof EnterpriseError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  try {
    const list = await enterpriseService.listSSOConfigs({ workspaceId: guard.workspaceId, userId: guard.userId })
    return NextResponse.json({ data: list })
  } catch (err) { return mapError(err) }
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(ssoConfigCreateSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const config = await enterpriseService.createSSOConfig(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(config, { status: 201 })
  } catch (err) { return mapError(err) }
}
