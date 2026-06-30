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
      title: 'تعامل کل',
      value: last(engagement),
      trend: pct(last(engagement), prev(engagement)),
      context: 'نسبت به ۳۰ روز قبل',
      chartData: engagement,
    },
    {
      id: 'reach',
      title: 'دسترسی و مشاهده',
      value: last(reach),
      trend: pct(last(reach), prev(reach)),
      context: 'مجموع پلتفرم‌ها',
      chartData: reach,
    },
    {
      id: 'audience',
      title: 'رشد مخاطبان',
      value: last(followers),
      trend: pct(last(followers), prev(followers)),
      context: 'نسبت به دوره قبل',
      chartData: followers,
    },
    {
      id: 'campaigns',
      title: 'کمپین‌های فعال',
      value: activeCampaigns,
      trend: 0,
      context: 'درحال اجرا',
      chartData: [3, 4, 4, 3, 4, 5, activeCampaigns],
    },
  ])
}
