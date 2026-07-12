export const INSTAGRAM_GRAPH_API_VERSION_ENV = 'INSTAGRAM_GRAPH_API_VERSION'
export const DEFAULT_INSTAGRAM_GRAPH_API_VERSION = 'v25.0'
export const INSTAGRAM_GRAPH_API_ORIGIN = 'https://graph.facebook.com'
export const INSTAGRAM_GRAPH_API_CHANGELOG_URL =
  'https://developers.facebook.com/docs/graph-api/changelog/'

export const INSTAGRAM_INBOX_REQUIRED_SCOPES = [
  'instagram_basic',
  'instagram_content_publish',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_manage_comments',
  'instagram_manage_messages',
] as const

export const INSTAGRAM_INBOX_API_LIMITS = {
  privateReplyWindowDays: 7,
  /** Standard DM messaging window: replies allowed 24h after the last inbound message. */
  dmMessagingWindowHours: 24,
  conversationMessageReadLimit: 20,
  commentListLimit: 50,
  webhookFirstEvents: ['comments', 'mentions', 'messages', 'messaging_postbacks'],
} as const

/**
 * When the reply window for a thread closes, per Meta policy:
 *   - dm: 24h after the last inbound message (standard messaging window;
 *     the human_agent tag can extend this but needs its own App Review)
 *   - comment / mention: 7 days after the comment was created
 * Returns null when the window can't be computed (no inbound yet).
 */
export function getReplyWindowExpiry(
  messageType: string,
  lastInboundAt: Date | string | null | undefined
): Date | null {
  if (!lastInboundAt) return null
  const base = new Date(lastInboundAt)
  if (Number.isNaN(base.getTime())) return null
  const ms =
    messageType === 'dm'
      ? INSTAGRAM_INBOX_API_LIMITS.dmMessagingWindowHours * 60 * 60 * 1000
      : INSTAGRAM_INBOX_API_LIMITS.privateReplyWindowDays * 24 * 60 * 60 * 1000
  return new Date(base.getTime() + ms)
}

type EnvLike = Record<string, string | undefined>

function readProcessEnv(): EnvLike {
  const candidate = globalThis as typeof globalThis & {
    process?: { env?: EnvLike }
  }
  return candidate.process?.env ?? {}
}

export function normalizeInstagramGraphApiVersion(version?: string | null): string {
  const trimmed = version?.trim()
  if (!trimmed) return DEFAULT_INSTAGRAM_GRAPH_API_VERSION

  const withoutPrefix = trimmed.replace(/^v/i, '')
  if (!/^\d+(?:\.\d+)?$/.test(withoutPrefix)) {
    return DEFAULT_INSTAGRAM_GRAPH_API_VERSION
  }
  return `v${withoutPrefix.includes('.') ? withoutPrefix : `${withoutPrefix}.0`}`
}

export function getInstagramGraphApiVersion(env: EnvLike = readProcessEnv()): string {
  return normalizeInstagramGraphApiVersion(env[INSTAGRAM_GRAPH_API_VERSION_ENV])
}

export function getInstagramGraphApiBaseUrl(env: EnvLike = readProcessEnv()): string {
  return `${INSTAGRAM_GRAPH_API_ORIGIN}/${getInstagramGraphApiVersion(env)}`
}

export function buildInstagramGraphApiUrl(path: string, env: EnvLike = readProcessEnv()): string {
  const normalizedPath = path.replace(/^\/+/, '')
  return `${getInstagramGraphApiBaseUrl(env)}/${normalizedPath}`
}

export function getInstagramGraphApiMetadata(env: EnvLike = readProcessEnv()) {
  const version = getInstagramGraphApiVersion(env)
  return {
    version,
    baseUrl: getInstagramGraphApiBaseUrl(env),
    defaultVersion: DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
    envVar: INSTAGRAM_GRAPH_API_VERSION_ENV,
    changelogUrl: INSTAGRAM_GRAPH_API_CHANGELOG_URL,
    isDefaultVersion: version === DEFAULT_INSTAGRAM_GRAPH_API_VERSION,
    requiredScopes: INSTAGRAM_INBOX_REQUIRED_SCOPES,
    inboxLimits: INSTAGRAM_INBOX_API_LIMITS,
  } as const
}
