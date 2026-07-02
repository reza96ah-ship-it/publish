import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams } from '@/lib/validations'
import { z } from 'zod'
import { analyticsService } from '@/modules/analytics'

export const dynamic = 'force-dynamic'

const analyticsQuerySchema = z.object({
  platform: z.string().max(50).optional(),
})

export async function GET(req: Request) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { searchParams } = new URL(req.url)
  const queryCheck = validateParams(analyticsQuerySchema, {
    platform: searchParams.get('platform') ?? undefined,
  })
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await analyticsService.getSnapshotSeries(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data.platform
  )
  return NextResponse.json(result)
}
