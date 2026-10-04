import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getWorkspaceZernioAnalytics } from '@/modules/analytics/zernio-workspace'

export const dynamic = 'force-dynamic'

const RANGE_DAYS: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 }

export async function GET(req: Request) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const { searchParams } = new URL(req.url)
  const days = RANGE_DAYS[searchParams.get('range') ?? '7d'] ?? 7
  const platformParam = searchParams.get('platform')
  const platform = platformParam && platformParam !== 'all' ? platformParam : null

  const activeCampaigns = await db.campaign.count({ where: { workspaceId, status: 'active' } })
  if (platform === null || platform === 'instagram') {
    const today = new Date().toISOString().slice(0, 10)
    const fromDate = new Date(Date.now() - (days - 1) * 86400_000).toISOString().slice(0, 10)
    const zernio = await getWorkspaceZernioAnalytics(workspaceId, fromDate, today)
    if (zernio) {
      return NextResponse.json([
        {
          id: 'engagement', title: 'نرخ تعامل', value: zernio.engagementRate,
          trend: null, context: zernio.engagementRate === null ? 'آمار تعامل در دسترس نیست' : 'تعاملات ÷ دسترسی در بازه انتخابی',
          chartData: [], source: 'zernio',
        },
        {
          id: 'reach', title: 'دسترسی اینستاگرام', value: zernio.reach,
          trend: null, context: 'دسترسی یکتای بازه انتخابی',
          chartData: zernio.dailyReach.map((point) => point.value), source: 'zernio',
        },
        {
          id: 'audience', title: 'رشد مخاطبان', value: zernio.followerGrowth,
          trend: null, context: zernio.followerGrowth === null ? 'تاریخچه فالوورها هنوز موجود نیست' : 'تغییر فالوورها در بازه انتخابی',
          chartData: zernio.followerHistory.map((point) => point.value), source: 'zernio',
        },
        {
          id: 'campaigns', title: 'کمپین‌های فعال', value: activeCampaigns,
          trend: null, context: 'کمپین‌های ساخته‌شده در نشرینو', chartData: [], source: 'zernio',
        },
      ])
    }
  }

  const since = new Date(Date.now() - (days + 1) * 86400_000)
  const snapshots = await db.analyticsSnapshot.findMany({
    where: { workspaceId, platform, date: { gte: since.toISOString().slice(0, 10) } },
    orderBy: { date: 'asc' },
    take: days * 4 + 8,
  })

  const byMetric = (m: string) => snapshots.filter((s) => s.metricType === m).map((s) => s.value)
  const reach = byMetric('reach')
  const engagement = byMetric('engagement')
  const followers = byMetric('followers')

  const last = (arr: number[]) => arr[arr.length - 1] ?? 0
  const prev = (arr: number[]) => arr[arr.length - 2] ?? arr[arr.length - 1] ?? 0
  const pct = (cur: number, p: number) => (p === 0 ? 0 : ((cur - p) / p) * 100)

  const periodLabel = days === 90 ? '۹۰ روز' : days === 30 ? '۳۰ روز' : '۷ روز'
  return NextResponse.json([
    {
      id: 'engagement', title: 'نمایش محتوا',
      value: last(engagement),
      trend: pct(last(engagement), prev(engagement)),
      context: `نسبت به ${periodLabel} قبل`,
      chartData: engagement,
    },
    {
      id: 'reach', title: 'دسترسی محتوا',
      value: last(reach),
      trend: pct(last(reach), prev(reach)),
      context: 'مجموع پلتفرم‌ها',
      chartData: reach,
    },
    {
      id: 'audience', title: 'دنبال‌کنندگان',
      value: last(followers),
      trend: pct(last(followers), prev(followers)),
      context: 'نسبت به دوره قبل',
      chartData: followers,
    },
    {
      id: 'campaigns', title: 'کمپین‌های فعال',
      value: activeCampaigns,
      trend: 0,
      context: 'درحال اجرا',
      chartData: [],
    },
  ])
}
