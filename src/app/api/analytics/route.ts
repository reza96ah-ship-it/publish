import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { validateParams } from '@/lib/validations'
import { z } from 'zod'

const analyticsQuerySchema = z.object({
  platform: z.string().max(50).optional(),
})

export async function GET(req: Request) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const { searchParams } = new URL(req.url)
  const queryCheck = validateParams(analyticsQuerySchema, {
    platform: searchParams.get('platform') ?? undefined,
  })
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })
  const platform = queryCheck.data.platform

  const snapshots = await db.analyticsSnapshot.findMany({
    where: { workspaceId, platform: platform === 'all' ? null : platform ?? null },
    orderBy: { date: 'asc' },
    take: 30,
  })

  const dates = [...new Set(snapshots.map((s) => s.date))].sort()
  const series = (metric: string) => dates.map((d) => snapshots.find((s) => s.date === d && s.metricType === metric)?.value ?? 0)

  return NextResponse.json({
    dates,
    reach: series('reach'),
    engagement: series('engagement'),
    followers: series('followers'),
    clicks: series('clicks'),
  })
}
