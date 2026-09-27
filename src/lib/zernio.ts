const API_BASE = 'https://zernio.com/api/v1'
const OBJECT_ID = /^[a-f\d]{24}$/i

export interface ZernioInstagramAccount {
  id: string
  username: string
  displayName: string | null
  profileUrl: string | null
  avatarUrl: string | null
  bio: string | null
  websiteUrl: string | null
  followersCount: number | null
  isActive: boolean
}

export interface ZernioInstagramInsights {
  reach: number | null
  views: number | null
  accountsEngaged: number | null
  totalInteractions: number | null
}

export interface ZernioDailyMetric {
  date: string
  value: number
}

export interface ZernioInstagramRangeInsights extends ZernioInstagramInsights {
  profileLinksTaps: number | null
}

export interface ZernioInstagramPost {
  id: string
  caption: string | null
  permalink: string | null
  mediaType: string | null
  createdTime: string | null
  likeCount: number | null
  commentCount: number | null
}

export interface ZernioInboxConversation {
  id: string
  accountId: string
  accountUsername: string
  participantName: string
  participantPicture: string | null
  lastMessage: string | null
  updatedTime: string | null
  unreadCount: number | null
  status: 'active' | 'archived' | 'unknown'
}

export interface ZernioInboxMessage {
  id: string
  direction: 'incoming' | 'outgoing' | 'unknown'
  senderName: string
  message: string
  createdAt: string | null
  attachmentCount: number
  isDeleted: boolean
}

export interface ZernioInboxPage<T> {
  data: T[]
  nextCursor: string | null
}

export class ZernioApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(`Zernio API error: ${code} (${status})`)
  }
}

async function zernioRequest(path: string, init?: RequestInit): Promise<Record<string, unknown>> {
  const apiKey = process.env.ZERNIO_API_KEY
  if (!apiKey) throw new ZernioApiError(503, 'not_configured')

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
  })
  const body: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const code = typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string'
      ? body.code
      : 'request_failed'
    throw new ZernioApiError(response.status, code)
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ZernioApiError(502, 'invalid_response')
  }
  return body as Record<string, unknown>
}

function readId(value: unknown): string | null {
  if (typeof value === 'string') return OBJECT_ID.test(value) ? value : null
  if (typeof value === 'object' && value !== null && '_id' in value) {
    return readId(value._id)
  }
  return null
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.toString() : null
  } catch {
    return null
  }
}

function websiteUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export async function createZernioProfile(workspaceId: string): Promise<string> {
  let body: Record<string, unknown>
  try {
    body = await zernioRequest('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name: `workspace_${workspaceId}` }),
    })
  } catch (error) {
    // A previous request may have created the profile before the local DB write.
    if (error instanceof ZernioApiError && error.status === 409) {
      const profiles = await zernioRequest('/profiles')
      const rows = Array.isArray(profiles.profiles) ? profiles.profiles : []
      const existing = rows.find((row) =>
        typeof row === 'object' && row !== null && 'name' in row && row.name === `workspace_${workspaceId}`
      ) as { _id?: unknown } | undefined
      const id = readId(existing?._id)
      if (id) return id
    }
    throw error
  }
  const profile = body.profile
  const id = typeof profile === 'object' && profile !== null && '_id' in profile
    ? readId(profile._id)
    : null
  if (!id) throw new ZernioApiError(502, 'invalid_profile_response')
  return id
}

export async function getInstagramConnectUrl(profileId: string, redirectUrl: string): Promise<string> {
  if (!OBJECT_ID.test(profileId)) throw new ZernioApiError(400, 'invalid_profile_id')
  const query = new URLSearchParams({ profileId, redirect_url: redirectUrl })
  const body = await zernioRequest(`/connect/instagram?${query}`)
  if (typeof body.authUrl !== 'string') throw new ZernioApiError(502, 'invalid_connect_response')
  const url = httpsUrl(body.authUrl)
  if (!url) throw new ZernioApiError(502, 'invalid_connect_url')
  const hostname = new URL(url).hostname
  if (!['instagram.com', 'www.instagram.com', 'facebook.com', 'www.facebook.com', 'zernio.com', 'www.zernio.com'].includes(hostname)) {
    throw new ZernioApiError(502, 'unexpected_connect_host')
  }
  return url
}

export async function listInstagramAccounts(profileId: string): Promise<ZernioInstagramAccount[]> {
  if (!OBJECT_ID.test(profileId)) throw new ZernioApiError(400, 'invalid_profile_id')
  const query = new URLSearchParams({ profileId, platform: 'instagram' })
  const body = await zernioRequest(`/accounts?${query}`)
  if (!Array.isArray(body.accounts)) throw new ZernioApiError(502, 'invalid_accounts_response')

  return body.accounts.flatMap((row): ZernioInstagramAccount[] => {
    if (typeof row !== 'object' || row === null) return []
    const account = row as Record<string, unknown>
    const id = readId(account._id)
    // Do not trust a provider-side filter alone for tenant isolation.
    if (!id || account.platform !== 'instagram' || readId(account.profileId) !== profileId) return []
    const profileData = objectValue(objectValue(account.metadata)?.profileData)
    return [{
      id,
      username: typeof account.username === 'string' ? account.username : '',
      displayName: typeof account.displayName === 'string' ? account.displayName : null,
      profileUrl: httpsUrl(account.profileUrl),
      avatarUrl: httpsUrl(account.profilePicture ?? account.profileImage ?? account.avatarUrl),
      bio: typeof profileData?.bio === 'string' ? profileData.bio.slice(0, 500) : null,
      websiteUrl: websiteUrl(profileData?.website),
      followersCount: nonnegativeNumber(account.followersCount ?? profileData?.followersCount),
      isActive: account.isActive === true,
    }]
  })
}

export async function getInstagramAccountInsights(accountId: string): Promise<ZernioInstagramInsights> {
  if (!OBJECT_ID.test(accountId)) throw new ZernioApiError(400, 'invalid_account_id')
  const query = new URLSearchParams({ accountId })
  const body = await zernioRequest(`/analytics/instagram/account-insights?${query}`)
  const metrics = objectValue(body.metrics)
  if (!metrics) throw new ZernioApiError(502, 'invalid_insights_response')
  const total = (name: string) => nonnegativeNumber(objectValue(metrics[name])?.total)
  return {
    reach: total('reach'),
    views: total('views'),
    accountsEngaged: total('accounts_engaged'),
    totalInteractions: total('total_interactions'),
  }
}

function validateAnalyticsRange(accountId: string, fromDate: string, toDate: string): URLSearchParams {
  if (!OBJECT_ID.test(accountId)) throw new ZernioApiError(400, 'invalid_account_id')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || fromDate > toDate) {
    throw new ZernioApiError(400, 'invalid_date_range')
  }
  return new URLSearchParams({ accountId, fromDate, toDate })
}

function metricValues(metrics: Record<string, unknown>, name: string): ZernioDailyMetric[] {
  const metric = objectValue(metrics[name])
  if (!Array.isArray(metric?.values)) return []
  return metric.values.flatMap((entry): ZernioDailyMetric[] => {
    const row = objectValue(entry)
    const value = nonnegativeNumber(row?.value)
    if (typeof row?.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || value === null) return []
    return [{ date: row.date, value }]
  }).sort((a, b) => a.date.localeCompare(b.date))
}

export async function getInstagramRangeInsights(
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioInstagramRangeInsights> {
  const query = validateAnalyticsRange(accountId, fromDate, toDate)
  query.set('metricType', 'total_value')
  query.set('metrics', 'reach,views,accounts_engaged,total_interactions,profile_links_taps')
  const body = await zernioRequest(`/analytics/instagram/account-insights?${query}`)
  const metrics = objectValue(body.metrics)
  if (!metrics) throw new ZernioApiError(502, 'invalid_insights_response')
  const total = (name: string) => nonnegativeNumber(objectValue(metrics[name])?.total)
  return {
    reach: total('reach'),
    views: total('views'),
    accountsEngaged: total('accounts_engaged'),
    totalInteractions: total('total_interactions'),
    profileLinksTaps: total('profile_links_taps'),
  }
}

export async function getInstagramDailyReach(
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioDailyMetric[]> {
  const query = validateAnalyticsRange(accountId, fromDate, toDate)
  query.set('metricType', 'time_series')
  query.set('metrics', 'reach')
  const body = await zernioRequest(`/analytics/instagram/account-insights?${query}`)
  const metrics = objectValue(body.metrics)
  if (!metrics) throw new ZernioApiError(502, 'invalid_reach_response')
  return metricValues(metrics, 'reach')
}

export async function getInstagramFollowerHistory(
  accountId: string,
  fromDate: string,
  toDate: string,
): Promise<ZernioDailyMetric[]> {
  const query = validateAnalyticsRange(accountId, fromDate, toDate)
  query.set('metricType', 'time_series')
  const body = await zernioRequest(`/analytics/instagram/follower-history?${query}`)
  const metrics = objectValue(body.metrics)
  if (!metrics) throw new ZernioApiError(502, 'invalid_follower_history_response')
  return metricValues(metrics, 'follower_count')
}

export async function getInstagramRecentPosts(accountId: string): Promise<ZernioInstagramPost[]> {
  if (!OBJECT_ID.test(accountId)) throw new ZernioApiError(400, 'invalid_account_id')
  const body = await zernioRequest(`/accounts/${accountId}/posts`)
  if (!Array.isArray(body.posts)) throw new ZernioApiError(502, 'invalid_posts_response')

  return body.posts.slice(0, 6).flatMap((row): ZernioInstagramPost[] => {
    const post = objectValue(row)
    if (!post || typeof post.id !== 'string') return []
    const caption = typeof post.message === 'string' ? post.message : post.caption
    return [{
      id: post.id,
      caption: typeof caption === 'string' ? caption.slice(0, 300) : null,
      permalink: httpsUrl(post.permalink),
      mediaType: typeof post.mediaType === 'string' ? post.mediaType : null,
      createdTime: typeof post.createdTime === 'string' ? post.createdTime : null,
      likeCount: nonnegativeNumber(post.likeCount),
      commentCount: nonnegativeNumber(post.commentCount),
    }]
  })
}

function validOpaque(value: string, name: string): string {
  if (!value || value.length > 500 || /[\u0000-\u001f]/.test(value)) {
    throw new ZernioApiError(400, `invalid_${name}`)
  }
  return value
}

function inboxConversation(value: unknown): ZernioInboxConversation | null {
  const row = objectValue(value)
  if (!row || typeof row.id !== 'string' || typeof row.accountId !== 'string') return null
  const status = row.status === 'active' || row.status === 'archived' ? row.status : 'unknown'
  return {
    id: validOpaque(row.id, 'conversation_id'),
    accountId: row.accountId,
    accountUsername: typeof row.accountUsername === 'string' ? row.accountUsername.slice(0, 100) : '',
    participantName: typeof row.participantName === 'string' ? row.participantName.slice(0, 200) : 'Instagram user',
    participantPicture: httpsUrl(row.participantPicture),
    lastMessage: typeof row.lastMessage === 'string' ? row.lastMessage.slice(0, 500) : null,
    updatedTime: typeof row.updatedTime === 'string' ? row.updatedTime : null,
    unreadCount: nonnegativeNumber(row.unreadCount),
    status,
  }
}

export async function listZernioInboxConversations(
  profileId: string,
  cursor?: string,
): Promise<ZernioInboxPage<ZernioInboxConversation> & { accountsFailed: number }> {
  if (!OBJECT_ID.test(profileId)) throw new ZernioApiError(400, 'invalid_profile_id')
  const query = new URLSearchParams({ profileId, platform: 'instagram', limit: '50' })
  if (cursor) query.set('cursor', validOpaque(cursor, 'cursor'))
  const body = await zernioRequest(`/inbox/conversations?${query}`)
  if (!Array.isArray(body.data)) throw new ZernioApiError(502, 'invalid_conversations_response')
  const pagination = objectValue(body.pagination)
  const meta = objectValue(body.meta)
  return {
    data: body.data.flatMap((value): ZernioInboxConversation[] => {
      const row = inboxConversation(value)
      return row && row.accountId.match(OBJECT_ID) && objectValue(value)?.platform === 'instagram' ? [row] : []
    }),
    nextCursor: typeof pagination?.nextCursor === 'string' ? pagination.nextCursor : null,
    accountsFailed: nonnegativeNumber(meta?.accountsFailed) ?? 0,
  }
}

export async function getZernioInboxConversation(
  accountId: string,
  conversationId: string,
): Promise<ZernioInboxConversation> {
  if (!OBJECT_ID.test(accountId)) throw new ZernioApiError(400, 'invalid_account_id')
  const id = validOpaque(conversationId, 'conversation_id')
  const query = new URLSearchParams({ accountId })
  const body = await zernioRequest(`/inbox/conversations/${encodeURIComponent(id)}?${query}`)
  const row = inboxConversation(body.data)
  if (!row || row.id !== id || row.accountId !== accountId || objectValue(body.data)?.platform !== 'instagram') {
    throw new ZernioApiError(404, 'conversation_not_found')
  }
  return row
}

export async function listZernioInboxMessages(
  accountId: string,
  conversationId: string,
  cursor?: string,
): Promise<ZernioInboxPage<ZernioInboxMessage>> {
  if (!OBJECT_ID.test(accountId)) throw new ZernioApiError(400, 'invalid_account_id')
  const id = validOpaque(conversationId, 'conversation_id')
  const query = new URLSearchParams({ accountId, limit: '50', sortOrder: 'desc' })
  if (cursor) query.set('cursor', validOpaque(cursor, 'cursor'))
  const body = await zernioRequest(`/inbox/conversations/${encodeURIComponent(id)}/messages?${query}`)
  if (!Array.isArray(body.messages)) throw new ZernioApiError(502, 'invalid_messages_response')
  const pagination = objectValue(body.pagination)
  return {
    data: body.messages.flatMap((value): ZernioInboxMessage[] => {
      const row = objectValue(value)
      if (!row || typeof row.id !== 'string' || row.conversationId !== id || row.accountId !== accountId) return []
      const isDeleted = row.isDeleted === true
      return [{
        id: validOpaque(row.id, 'message_id'),
        direction: row.direction === 'incoming' || row.direction === 'outgoing' ? row.direction : 'unknown',
        senderName: typeof row.senderName === 'string' ? row.senderName.slice(0, 200) : '',
        message: isDeleted ? 'پیام حذف شده است' : typeof row.message === 'string' ? row.message.slice(0, 10_000) : '',
        createdAt: typeof row.createdAt === 'string' ? row.createdAt : null,
        attachmentCount: !isDeleted && Array.isArray(row.attachments) ? row.attachments.length : 0,
        isDeleted,
      }]
    }),
    nextCursor: typeof pagination?.nextCursor === 'string' ? pagination.nextCursor : null,
  }
}
