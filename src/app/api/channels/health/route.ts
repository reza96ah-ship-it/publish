/**
 * GET /api/channels/health — per-channel health diagnostics (Issue #131).
 *
 * Returns for each connected channel:
 *   - Connection status (connected / expired / error) with Persian label
 *   - Token expiry date + days remaining (with warning if <7 days)
 *   - Granted OAuth scopes (from tokenScopes field)
 *   - Missing required permissions (highlighted)
 *   - Last successful publication date
 *   - 7-day failure rate (from PublicationAttempt aggregate)
 *   - API version in use
 *   - Reconnect action URL
 *
 * Data sources: Platform.tokenExpiresAt/tokenScopes/lastValidatedAt,
 * PublicationAttempt aggregate query for failure rate.
 */

import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

// Required OAuth scopes per platform type (Issue #131: "missing permissions highlighted in red")
const REQUIRED_SCOPES: Record<string, string[]> = {
  instagram: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
  linkedin: ['w_member_social', 'r_organization_social', 'w_organization_social'],
  telegram: [], // bot tokens don't use OAuth scopes
  bale: [],
  rubika: [],
  eitaa: [],
}

// API version per platform (Issue #131: "API version in use")
const API_VERSIONS: Record<string, string> = {
  instagram: 'Graph API v21.0',
  linkedin: 'REST Posts API 202505',
  telegram: 'Bot API 8.x',
  bale: 'Bot API (Bale)',
  rubika: 'Bot API v3',
  eitaa: 'Bot API v3 (Rubika-compatible)',
}

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const platforms = await db.platform.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      type: true,
      username: true,
      status: true,
      circuitState: true,
      lastSuccessAt: true,
      lastError: true,
      primaryIssue: true,
      tokenExpiresAt: true,
      tokenScopes: true,
      lastValidatedAt: true,
    },
  })

  // Aggregate PublicationAttempt outcomes for 7-day failure rate (Issue #131)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const attempts = await db.publicationAttempt.findMany({
    where: {
      startedAt: { gte: sevenDaysAgo },
      job: { workspaceId },
    },
    select: { outcome: true, job: { select: { platformId: true } } },
  })

  // Build per-platform attempt stats
  const statsByPlatform = new Map<
    string,
    { total: number; failed: number }
  >()
  for (const a of attempts) {
    const pid = a.job.platformId
    const cur = statsByPlatform.get(pid) ?? { total: 0, failed: 0 }
    cur.total++
    if (
      a.outcome === 'retryable_failure' ||
      a.outcome === 'permanent_failure' ||
      a.outcome === 'outcome_unknown'
    ) {
      cur.failed++
    }
    statsByPlatform.set(pid, cur)
  }

  const result = platforms.map((p) => {
    const tokenExpiresAt = p.tokenExpiresAt
    const daysRemaining = tokenExpiresAt
      ? Math.ceil((tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
      : null

    const grantedScopes = p.tokenScopes
      ? p.tokenScopes.split(',').map((s) => s.trim()).filter(Boolean)
      : []

    const requiredScopes = REQUIRED_SCOPES[p.type] ?? []
    const missingScopes = requiredScopes.filter((s) => !grantedScopes.includes(s))

    const stats = statsByPlatform.get(p.id) ?? { total: 0, failed: 0 }
    const failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      username: p.username,
      status: p.status,
      statusLabel: statusLabel(p.status, p.circuitState),
      statusColor: statusColor(p.status, p.circuitState),
      tokenExpiresAt: tokenExpiresAt?.toISOString() ?? null,
      daysRemaining,
      tokenWarning: daysRemaining !== null && daysRemaining < 7,
      tokenExpired: daysRemaining !== null && daysRemaining <= 0,
      grantedScopes,
      requiredScopes,
      missingScopes,
      lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
      lastError: p.lastError,
      lastValidatedAt: p.lastValidatedAt?.toISOString() ?? null,
      failureRate7d: Math.round(failureRate * 10) / 10, // 1 decimal
      attemptCount7d: stats.total,
      apiVersion: API_VERSIONS[p.type] ?? 'نامشخص',
      reconnectUrl: `/channels?reconnect=${p.id}`,
    }
  })

  return NextResponse.json(result)
}

function statusLabel(status: string, circuitState: string): string {
  if (status === 'expired') return 'منقضی — نیاز به اتصال مجدد'
  if (status === 'error' || circuitState === 'open') return 'اختلال API'
  if (status === 'disconnected') return 'قطع شده'
  return 'متصل و پایدار'
}

function statusColor(status: string, circuitState: string): string {
  if (status === 'expired') return 'text-amber-700 bg-amber-50 border-amber-200'
  if (status === 'error' || circuitState === 'open')
    return 'text-rose-700 bg-rose-50 border-rose-200'
  if (status === 'disconnected') return 'text-slate-700 bg-slate-50 border-slate-200'
  return 'text-emerald-700 bg-emerald-50 border-emerald-200'
}
