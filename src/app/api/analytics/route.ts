import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET(req: Request) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const platform = searchParams.get('platform') // null = aggregate

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
