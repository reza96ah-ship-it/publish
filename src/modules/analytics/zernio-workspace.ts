import {
  getInstagramDailyReach,
  getInstagramFollowerHistory,
  getInstagramRangeInsights,
  type ZernioDailyMetric,
  type ZernioInstagramRangeInsights,
} from '@/lib/zernio'
import { listOwnedWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'

export interface ZernioWorkspaceAnalytics {
  source: 'zernio'
  accountCount: number
  fromDate: string
  toDate: string
  reach: number | null
  views: number | null
  accountsEngaged: number | null
  totalInteractions: number | null
  profileLinksTaps: number | null
  engagementRate: number | null
  currentFollowers: number | null
  followerGrowth: number | null
  dailyReach: ZernioDailyMetric[]
  followerHistory: ZernioDailyMetric[]
  status: 'available' | 'partial' | 'unavailable'
}

type AccountResult = {
  totals: ZernioInstagramRangeInsights | null
  reach: ZernioDailyMetric[] | null
  followers: ZernioDailyMetric[] | null
  currentFollowers: number | null
}

const CACHE_MS = 5 * 60_000
const cache = new Map<string, { expires: number; value: Promise<ZernioWorkspaceAnalytics | null> }>()

function sumAvailable(rows: AccountResult[], get: (row: AccountResult) => number | null): number | null {
  const values = rows.map(get)
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null
}

function combineDaily(rows: Array<ZernioDailyMetric[] | null>): ZernioDailyMetric[] {
  if (rows.length === 0 || !rows.every((row): row is ZernioDailyMetric[] => row !== null && row.length > 0)) return []
  const maps = rows.map((row) => new Map(row.map((point) => [point.date, point.value])))
  return [...maps[0].keys()].filter((date) => maps.every((map) => map.has(date)))
    .sort()
    .map((date) => ({ date, value: maps.reduce((sum, map) => sum + (map.get(date) ?? 0), 0) }))
}

async function loadWorkspaceAnalytics(
  workspaceId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioWorkspaceAnalytics | null> {
  const connection = await listOwnedWorkspaceZernioInstagram(workspaceId)
  if (!connection) return null
  const accounts = connection.accounts.filter((account) => account.isActive)
  if (accounts.length === 0) return null

  // Zernio's follower-history endpoint permits at most 89 days.
  const followerFrom = new Date(Math.max(
    Date.parse(`${fromDate}T00:00:00Z`),
    Date.parse(`${toDate}T00:00:00Z`) - 88 * 86400_000,
  )).toISOString().slice(0, 10)

  const results: AccountResult[] = await Promise.all(accounts.map(async (account) => {
    const [totals, reach, followers] = await Promise.allSettled([
      getInstagramRangeInsights(account.id, fromDate, toDate),
      getInstagramDailyReach(account.id, fromDate, toDate),
      getInstagramFollowerHistory(account.id, followerFrom, toDate),
    ])
    return {
      totals: totals.status === 'fulfilled' ? totals.value : null,
      reach: reach.status === 'fulfilled' ? reach.value : null,
      followers: followers.status === 'fulfilled' ? followers.value : null,
      currentFollowers: account.followersCount,
    }
  }))

  const reach = sumAvailable(results, (row) => row.totals?.reach ?? null)
  const totalInteractions = sumAvailable(results, (row) => row.totals?.totalInteractions ?? null)
  const dailyReach = combineDaily(results.map((row) => row.reach))
  const followerHistory = combineDaily(results.map((row) => row.followers))
  const currentFollowers = sumAvailable(results, (row) => row.currentFollowers)
  const followerGrowth = followerHistory.length >= 2
    ? followerHistory[followerHistory.length - 1].value - followerHistory[0].value
    : null
  const hasAnyData = reach !== null || dailyReach.length > 0 || currentFollowers !== null
  const hasAllSources = results.every((row) => row.totals !== null && row.reach !== null && row.followers !== null)

  return {
    source: 'zernio',
    accountCount: accounts.length,
    fromDate,
    toDate,
    reach,
    views: sumAvailable(results, (row) => row.totals?.views ?? null),
    accountsEngaged: sumAvailable(results, (row) => row.totals?.accountsEngaged ?? null),
    totalInteractions,
    profileLinksTaps: sumAvailable(results, (row) => row.totals?.profileLinksTaps ?? null),
    engagementRate: reach !== null && reach > 0 && totalInteractions !== null
      ? (totalInteractions / reach) * 100
      : null,
    currentFollowers,
    followerGrowth,
    dailyReach,
    followerHistory,
    status: !hasAnyData ? 'unavailable' : hasAllSources ? 'available' : 'partial',
  }
}

export async function getWorkspaceZernioAnalytics(
  workspaceId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioWorkspaceAnalytics | null> {
  const key = `${workspaceId}:${fromDate}:${toDate}`
  const existing = cache.get(key)
  if (existing && existing.expires > Date.now()) return existing.value
  const value = loadWorkspaceAnalytics(workspaceId, fromDate, toDate)
  cache.set(key, { expires: Date.now() + CACHE_MS, value })
  value.catch(() => { if (cache.get(key)?.value === value) cache.delete(key) })
  return value
}
