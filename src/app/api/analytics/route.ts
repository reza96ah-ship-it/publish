import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateParams } from '@/lib/validations'
import { z } from 'zod'
import { analyticsService } from '@/modules/analytics'

export const dynamic = 'force-dynamic'

const analyticsQuerySchema = z.object({
  platform: z.string().max(50).optional(),
  range: z.enum(['7d', '30d', '90d']).optional(),
  // compare=1 doubles the window so the client can overlay the previous period
  compare: z.enum(['1']).optional(),
})

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const

export async function GET(req: Request) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error

  const { searchParams } = new URL(req.url)
  const queryCheck = validateParams(analyticsQuerySchema, {
    platform: searchParams.get('platform') ?? undefined,
    range: searchParams.get('range') ?? undefined,
    compare: searchParams.get('compare') ?? undefined,
  })
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const days = RANGE_DAYS[queryCheck.data.range ?? '30d']
  const result = await analyticsService.getSnapshotSeries(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data.platform,
    queryCheck.data.compare === '1' ? days * 2 : days
  )
  return NextResponse.json(result)
}
