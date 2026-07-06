/**
 * Issue #215: per-post metrics — shared constants safe for client bundles.
 * No Prisma / crypto / Node dependencies here; the collector lives in
 * ./post-metrics.ts (server-only).
 */

export const POST_METRIC_TYPES = ['reach', 'likes', 'comments', 'saved'] as const
export type PostMetricType = (typeof POST_METRIC_TYPES)[number]

export const POST_METRIC_LABELS: Record<PostMetricType, string> = {
  reach: 'دسترسی',
  likes: 'پسند',
  comments: 'دیدگاه',
  saved: 'ذخیره',
}

export interface PostMetricsSupport {
  metrics: PostMetricType[]
  note: string
}

// Which per-post metrics each provider's API exposes.
export const POST_METRICS_SUPPORT: Record<string, PostMetricsSupport> = {
  instagram: {
    metrics: ['reach', 'likes', 'comments', 'saved'],
    note: 'از Instagram Graph API (media insights)',
  },
  telegram: {
    metrics: [],
    note: 'Bot API تلگرام آمار بازدید هر پست را ارائه نمی‌دهد',
  },
  linkedin: {
    metrics: [],
    note: 'آمار پست لینکدین نیازمند دسترسی Marketing API است',
  },
  bale: { metrics: [], note: 'API بله آمار هر پست را ارائه نمی‌دهد' },
  rubika: { metrics: [], note: 'API روبیکا آمار هر پست را ارائه نمی‌دهد' },
  eitaa: { metrics: [], note: 'API ایتا آمار هر پست را ارائه نمی‌دهد' },
}

export function getPostMetricsSupport(platformType: string): PostMetricsSupport {
  return (
    POST_METRICS_SUPPORT[platformType] ?? {
      metrics: [],
      note: 'آمار هر پست برای این سرویس در دسترس نیست',
    }
  )
}
