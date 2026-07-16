/**
 * DELETE /api/platforms/[id] — disconnect a platform.
 *
 * Unsubscribes provider webhooks (Instagram), nullifies the stored credential,
 * and marks the platform as disconnected. Workspace drafts and historical
 * publications are preserved. Writes an audit log entry.
 *
 * TC-CONN-10 coverage: disconnect, webhook unsubscription, data preservation,
 * workspace isolation (platform ownership verified inside the service).
 */

import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { channelsService, PlatformNotFoundError } from '@/modules/channels'

export const dynamic = 'force-dynamic'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error

  try {
    const result = await channelsService.disconnectPlatform(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof PlatformNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    throw err
  }
}
