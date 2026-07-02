/**
 * POST /api/platforms/[id]/connect — connect a platform with real credential validation.
 *
 * Issue #144: Before this fix, Instagram/LinkedIn were set to `valid = true`
 * without contacting the provider. Expiry was guessed as `now + 60 days`.
 * Token scopes were never populated.
 *
 * After: all providers go through their auth adapter which:
 *   - Validates the credential by contacting the provider API
 *   - Returns real expiry (from provider response, not guessed)
 *   - Returns real granted scopes
 *   - Verifies target channel/bot permissions for bot-token providers
 *   - Never marks a provider active without successful validation
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, platformConnectSchema } from '@/lib/validations'
import { channelsService, PlatformNotFoundError, UnsupportedProviderError, CredentialValidationError } from '@/modules/channels'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(platformConnectSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await channelsService.connectPlatform(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      id,
      validation.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlatformNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (err instanceof UnsupportedProviderError) return NextResponse.json({ error: err.message }, { status: 400 })
    if (err instanceof CredentialValidationError) return NextResponse.json({ error: err.message }, { status: 400 })
    throw err
  }
}
