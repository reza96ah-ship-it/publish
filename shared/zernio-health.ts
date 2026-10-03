export interface ZernioAccountHealth {
  status: 'healthy' | 'warning' | 'error'
  tokenValid: boolean | null
  tokenExpiresAt: string | null
  needsRefresh: boolean | null
  canPost: boolean | null
  canFetchAnalytics: boolean | null
  missingRequired: string[]
  checkedAt: string
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function booleanOrNull(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

/** Parse only the fields the product uses; never pass through provider tokens or metadata. */
export function parseZernioAccountHealth(body: unknown, accountId: string): ZernioAccountHealth | null {
  const data = record(body)
  if (!data || data.accountId !== accountId || data.platform !== 'instagram') return null
  if (data.status !== 'healthy' && data.status !== 'warning' && data.status !== 'error') return null

  const token = record(data.tokenStatus)
  const permissions = record(data.permissions)
  const expiresAt = token?.expiresAt
  const missingRequired = permissions?.missingRequired

  return {
    status: data.status,
    tokenValid: booleanOrNull(token?.valid),
    tokenExpiresAt: typeof expiresAt === 'string' && !Number.isNaN(Date.parse(expiresAt)) ? expiresAt : null,
    needsRefresh: booleanOrNull(token?.needsRefresh),
    canPost: booleanOrNull(permissions?.canPost),
    canFetchAnalytics: booleanOrNull(permissions?.canFetchAnalytics),
    missingRequired: Array.isArray(missingRequired)
      ? missingRequired.filter((scope): scope is string => typeof scope === 'string').slice(0, 10)
      : [],
    checkedAt: new Date().toISOString(),
  }
}
