import {
  getInstagramActiveStories,
  getInstagramDemographics,
  getInstagramStoryInsights,
  type ZernioInstagramDemographics,
  type ZernioInstagramStory,
} from '@/lib/zernio'
import { listOwnedWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'

export interface ZernioExtraAccount {
  id: string
  username: string
  stories: ZernioInstagramStory[] | null
  demographics: ZernioInstagramDemographics | null
  demographicsReason: 'available' | 'followers_below_100' | 'unavailable'
}

const cache = new Map<string, { expires: number; result: Promise<ZernioExtraAccount[]> }>()

async function load(workspaceId: string): Promise<ZernioExtraAccount[]> {
  const connection = await listOwnedWorkspaceZernioInstagram(workspaceId)
  if (!connection) return []
  const accounts = connection.accounts.filter((account) => account.isActive)
  return Promise.all(accounts.map(async (account) => {
    const [storiesResult, demographicsResult] = await Promise.allSettled([
      getInstagramActiveStories(account.id),
      account.followersCount !== null && account.followersCount < 100
        ? Promise.resolve(null) : getInstagramDemographics(account.id),
    ])
    const stories = storiesResult.status === 'fulfilled'
      ? await Promise.all(storiesResult.value.map(async (story) => {
        try { return { ...story, insights: await getInstagramStoryInsights(account.id, story.id) } }
        catch { return story }
      })) : null
    const demographics = demographicsResult.status === 'fulfilled' ? demographicsResult.value : null
    return {
      id: account.id,
      username: account.username,
      stories,
      demographics,
      demographicsReason: demographics
        ? 'available' as const
        : account.followersCount !== null && account.followersCount < 100
          ? 'followers_below_100' as const : 'unavailable' as const,
    }
  }))
}

export function getWorkspaceZernioExtra(workspaceId: string): Promise<ZernioExtraAccount[]> {
  const existing = cache.get(workspaceId)
  if (existing && existing.expires > Date.now()) return existing.result
  const result = load(workspaceId)
  cache.set(workspaceId, { expires: Date.now() + 5 * 60_000, result })
  result.catch(() => { if (cache.get(workspaceId)?.result === result) cache.delete(workspaceId) })
  return result
}
