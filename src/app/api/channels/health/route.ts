/**
 * GET /api/channels/health — per-channel health diagnostics (Issue #131).
 *
 * Issue #200: thin handler. Aggregation + label/color mapping lives in
 * src/modules/channels/service.ts (ChannelsService.getChannelHealth).
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { channelsService } from '@/modules/channels'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('platform.manage')
  if (guard.error) return guard.error

  const result = await channelsService.getChannelHealth({
    workspaceId: guard.workspaceId,
    userId: guard.userId,
  })
  return NextResponse.json(result)
}
