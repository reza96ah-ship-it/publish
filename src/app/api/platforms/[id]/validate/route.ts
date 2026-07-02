/**
 * POST /api/platforms/[id]/validate — test connection by calling getMe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { channelsService, PlatformNotFoundError, CredentialValidationError } from '@/modules/channels'
import { platformRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error

  const { success: rateOk } = await platformRateLimit(guard.workspaceId, idCheck.data)
  if (!rateOk) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 })
  }

  try {
    const result = await channelsService.validatePlatform(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlatformNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (err instanceof CredentialValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }
}
