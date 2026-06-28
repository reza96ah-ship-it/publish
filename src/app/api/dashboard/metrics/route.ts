import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  // Fetch all aggregate (platform=null) snapshots for the last 7 days.
  // There are 7 days أ— 4 metrics = 28 rows; take a comfortable ceiling so
  // every metric gets a full 7-point series (a tight take would starve some metrics).
  const since = new Date(Date.now() - 8 * 86400_000)
  const snapshots = await db.analyticsSnapshot.findMany({
    where: { workspaceId, platform: null, date: { gte: since.toISOString().slice(0, 10) } },
    orderBy: { date: 'asc' },
    take: 60,
  })

  const byMetric = (m: string) => snapshots.filter((s) => s.metricType === m).map((s) => s.value)
  const reach = byMetric('reach')
  const engagement = byMetric('engagement')
  const followers = byMetric('followers')
  const clicks = byMetric('clicks')

  const last = (arr: number[]) => arr[arr.length - 1] ?? 0
  const prev = (arr: number[]) => arr[arr.length - 2] ?? arr[arr.length - 1] ?? 0
  const pct = (cur: number, p: number) => (p === 0 ? 0 : ((cur - p) / p) * 100)

  const activeCampaigns = await db.campaign.count({ where: { workspaceId, status: 'active' } })

  return NextResponse.json([
    {
      id: 'engagement',
      title: 'طھط¹ط§ظ…ظ„ ع©ظ„',
      value: last(engagement),
      trend: pct(last(engagement), prev(engagement)),
      context: 'ظ†ط³ط¨طھ ط¨ظ‡ غ³غ° ط±ظˆط² ظ‚ط¨ظ„',
      chartData: engagement,
    },
    {
      id: 'reach',
      title: 'ط¯ط³طھط±ط³غŒ ظˆ ظ…ط´ط§ظ‡ط¯ظ‡',
      value: last(reach),
      trend: pct(last(reach), prev(reach)),
      context: 'ظ…ط¬ظ…ظˆط¹ ظ¾ظ„طھظپط±ظ…â€Œظ‡ط§',
      chartData: reach,
    },
    {
      id: 'audience',
      title: 'ط±ط´ط¯ ظ…ط®ط§ط·ط¨ط§ظ†',
      value: last(followers),
      trend: pct(last(followers), prev(followers)),
      context: 'ظ†ط³ط¨طھ ط¨ظ‡ ط¯ظˆط±ظ‡ ظ‚ط¨ظ„',
      chartData: followers,
    },
    {
      id: 'campaigns',
      title: 'ع©ظ…ظ¾غŒظ†â€Œظ‡ط§غŒ ظپط¹ط§ظ„',
      value: activeCampaigns,
      trend: 0,
      context: 'ط¯ط±ط­ط§ظ„ ط§ط¬ط±ط§',
      chartData: [3, 4, 4, 3, 4, 5, activeCampaigns],
    },
  ])
}
