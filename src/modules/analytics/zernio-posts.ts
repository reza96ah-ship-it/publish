import { getInstagramRecentPosts } from '@/lib/zernio'
import { listOwnedWorkspaceZernioInstagram } from '@/modules/channels/zernio-sync'
import type { PostMetricType } from './post-metrics'

export interface PostRow {
  id: string
  title: string
  platform: string
  platformName: string
  providerPostId: string | null
  publishedAt: Date | null
  scheduledAt: Date | null
  campaign: string | null
  metrics: Partial<Record<PostMetricType, number>>
  metricsSupported: boolean
  source?: 'zernio'
  permalink?: string | null
}

/** Connected-provider posts are separate from this app's publication history. */
export async function getZernioRecentPostRows(
  workspaceId: string,
  nativeProviderIds: Set<string | null>,
): Promise<PostRow[]> {
  try {
    const connection = await listOwnedWorkspaceZernioInstagram(workspaceId)
    if (!connection) return []
    const accounts = connection.accounts.filter((account) => account.isActive)
    const recent = await Promise.all(accounts.map(async (account) => ({
      account, posts: await getInstagramRecentPosts(account.id),
    })))
    return recent.flatMap(({ account, posts }) => posts.flatMap((post): PostRow[] => {
      if (nativeProviderIds.has(post.id)) return []
      return [{
        id: `zernio:${post.id}`,
        title: post.caption?.slice(0, 90) || 'پست اینستاگرام',
        platform: 'instagram',
        platformName: `@${account.username}`,
        providerPostId: post.id,
        publishedAt: post.createdTime ? new Date(post.createdTime) : null,
        scheduledAt: null,
        campaign: null,
        metrics: {
          ...(post.likeCount !== null ? { likes: post.likeCount } : {}),
          ...(post.commentCount !== null ? { comments: post.commentCount } : {}),
        },
        metricsSupported: true,
        source: 'zernio',
        permalink: post.permalink,
      }]
    }))
  } catch {
    // Local publication history remains usable during provider outages.
    return []
  }
}
