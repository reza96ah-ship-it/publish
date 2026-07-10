/**
 * Channels domain module — service layer.
 * Business logic for platform (channel) lifecycle: list, connect, validate.
 * No HTTP. No direct Prisma.
 */

import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { getProviderAuthAdapter } from '@/lib/provider-auth'
import { isPlatformEnabled } from '@/lib/provider-capabilities'
import {
  computeCredentialStatus,
  REQUIRED_SCOPES,
  type BotTokenInput,
  type CredentialHealth,
  type ProviderCredential,
} from '@/lib/provider-auth/types'
import { ChannelsRepository } from './repository'
import {
  PlatformNotFoundError,
  UnsupportedProviderError,
  CredentialValidationError,
} from './errors'
import type {
  AuthContext,
  ConnectInput,
  ConnectResult,
  PlatformListResult,
  ValidateResult,
  ChannelHealthItem,
} from './types'

type BotTokenAdapter = {
  validateBotToken(input: BotTokenInput): Promise<{
    valid: boolean
    botInfo?: { username?: string; first_name?: string; [key: string]: unknown }
    health: CredentialHealth
    credential?: Partial<ProviderCredential>
  }>
}

function stateLabel(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'نیازمند احراز مجدد'
  if (p.status === 'error' || p.circuitState === 'open') return 'اختلال API'
  if (p.status === 'disconnected') return 'قطع شده'
  if (p.accountKind === 'personal') return 'حساب شخصی (دستی)'
  return 'متصل و پایدار'
}
function stateColor(p: { status: string; circuitState: string; accountKind: string }) {
  if (p.status === 'expired') return 'text-warning bg-warning-soft border-warning/20'
  if (p.status === 'error' || p.circuitState === 'open') return 'text-danger bg-danger-soft border-danger/20'
  if (p.status === 'disconnected') return 'text-muted-foreground bg-muted border-border'
  if (p.accountKind === 'personal') return 'text-info bg-info-soft border-info/20'
  return 'text-success bg-success-soft border-success/20'
}

export class ChannelsService {
  constructor(
    private readonly repo: ChannelsRepository = new ChannelsRepository()
  ) {}

  async listPlatforms(
    auth: AuthContext,
    query: { cursor?: string; limit: number }
  ): Promise<PlatformListResult> {
    const { workspaceId } = auth
    const rows = await this.repo.listByWorkspace(workspaceId, query.cursor, query.limit)
    const countMap = await this.repo.countByType(workspaceId)

    const hasMore = rows.length > query.limit
    const page = hasMore ? rows.slice(0, query.limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null

    return {
      data: page.map((p) => ({
        id: p.id,
        name: p.name,
        type: p.type,
        state: stateLabel(p),
        stateColor: stateColor(p),
        accounts: countMap.get(p.type) ?? 1,
        primaryIssue: p.primaryIssue,
        lastSuccess: p.lastSuccessAt,
        accountKind: p.accountKind,
        circuitState: p.circuitState,
        username: p.username,
      })),
      nextCursor,
    }
  }

  async connectPlatform(
    auth: AuthContext,
    platformId: string,
    input: ConnectInput
  ): Promise<ConnectResult> {
    const { workspaceId, userId } = auth
    const platform = await this.repo.findInWorkspace(platformId, workspaceId)
    if (!platform) throw new PlatformNotFoundError()

    if (!isPlatformEnabled(platform.type)) throw new UnsupportedProviderError(platform.type)

    const adapter = getProviderAuthAdapter(platform.type)
    if (!adapter) throw new UnsupportedProviderError(platform.type)

    let valid = false
    let botInfo: { username?: string; first_name?: string; [key: string]: unknown } | null = null
    let realExpiresAt: Date | null = null
    let grantedScopes: string[] = []
    let accountId = ''
    let accountName = ''
    let errorMessage = ''

    if ('validateBotToken' in adapter) {
      const result = await (adapter as BotTokenAdapter).validateBotToken({
        token: input.token,
        targetId: input.targetId,
      })
      valid = result.valid
      botInfo = result.botInfo ?? null
      errorMessage = result.health.message
      if (result.credential) {
        realExpiresAt = result.credential.expiresAt ?? null
        grantedScopes = result.credential.scopes || []
        accountId = result.credential.accountId || ''
        accountName = result.credential.accountName || ''
      }
    } else {
      const health = await adapter.validateCredential({ accessTokenEncrypted: encrypt(input.token), targetId: input.targetId })
      if (health.status === 'active') {
        valid = true
        realExpiresAt = platform.tokenExpiresAt
        grantedScopes = REQUIRED_SCOPES[platform.type] || []
        accountId = platform.targetId || ''
        accountName = platform.name
      } else {
        valid = false
        errorMessage = health.message
      }
    }

    if (!valid) {
      await this.repo.update(platformId, {
        status: 'error',
        lastError: errorMessage,
        lastValidatedAt: new Date(),
      })
      throw new CredentialValidationError(errorMessage)
    }

    const credentialStatus = computeCredentialStatus(
      { status: 'active', canPublish: true, message: '', missingScopes: [], validatedAt: new Date() },
      realExpiresAt
    )

    await this.repo.update(platformId, {
      tokenSecret: encrypt(input.token),
      targetId: input.targetId || platform.targetId,
      name: input.name || (botInfo?.username ? `@${botInfo.username}` : accountName || platform.name),
      username: botInfo?.username || platform.username,
      status: credentialStatus,
      lastError: null,
      lastValidatedAt: new Date(),
      circuitState: 'closed',
      tokenExpiresAt: realExpiresAt,
      tokenScopes: grantedScopes.length > 0 ? grantedScopes.join(',') : null,
    })

    try {
      await db.auditLog.create({
        data: {
          userId,
          workspaceId,
          action: 'platform.connected',
          resource: 'Platform',
          metadata: {
            platformId,
            platformType: platform.type,
            accountId,
            scopes: grantedScopes,
            expiresAt: realExpiresAt?.toISOString() ?? null,
          },
        },
      })
    } catch { /* audit write failure is non-fatal */ }

    return {
      ok: true,
      botInfo: botInfo ? { username: botInfo.username, firstName: botInfo.first_name as string | undefined } : null,
      credentialStatus,
      expiresAt: realExpiresAt?.toISOString() ?? null,
      scopes: grantedScopes,
    }
  }

  async validatePlatform(auth: AuthContext, platformId: string): Promise<ValidateResult> {
    const { workspaceId } = auth
    const platform = await this.repo.findInWorkspace(platformId, workspaceId)
    if (!platform) throw new PlatformNotFoundError()

    if (!platform.tokenSecret) {
      throw new CredentialValidationError('توکن تنظیم نشده است')
    }

    type RawBot = { username?: string; first_name?: string }
    let valid = false
    let rawBot: RawBot | null = null
    const token = decrypt(platform.tokenSecret)

    if (platform.type === 'telegram') {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
        const data = await res.json() as { ok: boolean; result?: RawBot }
        valid = data.ok
        rawBot = data.result ?? null
      } catch { /* provider unreachable — valid stays false */ }
    } else if (platform.type === 'bale') {
      try {
        const res = await fetch(`https://tapi.bale.ai/bot${token}/getMe`)
        const data = await res.json() as { ok: boolean; result?: RawBot }
        valid = data.ok
        rawBot = data.result ?? null
      } catch { /* provider unreachable */ }
    } else if (platform.type === 'rubika') {
      try {
        const res = await fetch(`https://botapi.rubika.ir/v3/${token}/getMe`, { method: 'POST' })
        const data = await res.json() as { status?: string; ok?: boolean; data?: RawBot; result?: RawBot }
        valid = data.status === 'OK' || !!data.ok
        rawBot = data.data ?? data.result ?? null
      } catch { /* provider unreachable */ }
    } else {
      valid = true
    }

    await this.repo.update(platformId, {
      status: valid ? 'active' : 'error',
      lastError: valid ? null : 'اعتبارسنجی ناموفق',
    })

    return {
      valid,
      botInfo: rawBot ? { username: rawBot.username, firstName: rawBot.first_name } : null,
    }
  }

  /**
   * GET /api/channels/health — per-channel health diagnostics (Issue #131).
   * Returns connection status, token expiry, granted/missing scopes, last
   * successful publication, 7-day failure rate, and API version per channel.
   */
  async getChannelHealth(auth: AuthContext): Promise<ChannelHealthItem[]> {
    const workspaceId = auth.workspaceId

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

    const statsByPlatform = new Map<string, { total: number; failed: number }>()
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

    return platforms.map((p) => {
      const daysRemaining = p.tokenExpiresAt
        ? Math.ceil((p.tokenExpiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
        : null

      // OAuth providers may return scopes in any case — normalise to lowercase
      const grantedScopes = p.tokenScopes
        ? p.tokenScopes.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : []
      const requiredScopes = REQUIRED_SCOPES[p.type] ?? []
      const missingScopes = requiredScopes.filter(
        (s) => !grantedScopes.includes(s.toLowerCase()),
      )

      const stats = statsByPlatform.get(p.id) ?? { total: 0, failed: 0 }
      const failureRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0

      return {
        id: p.id,
        name: p.name,
        type: p.type,
        username: p.username,
        status: p.status,
        statusLabel: healthStatusLabel(p.status, p.circuitState),
        statusColor: healthStatusColor(p.status, p.circuitState),
        tokenExpiresAt: p.tokenExpiresAt?.toISOString() ?? null,
        daysRemaining,
        tokenWarning: daysRemaining !== null && daysRemaining < 7,
        tokenExpired: daysRemaining !== null && daysRemaining <= 0,
        grantedScopes,
        requiredScopes,
        missingScopes,
        lastSuccessAt: p.lastSuccessAt?.toISOString() ?? null,
        lastError: p.lastError,
        lastValidatedAt: p.lastValidatedAt?.toISOString() ?? null,
        failureRate7d: Math.round(failureRate * 10) / 10,
        attemptCount7d: stats.total,
        apiVersion: API_VERSIONS[p.type] ?? 'نامشخص',
        reconnectUrl: `/channels?reconnect=${p.id}`,
      }
    })
  }
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

function healthStatusLabel(status: string, circuitState: string): string {
  if (status === 'expired') return 'منقضی — نیاز به اتصال مجدد'
  if (status === 'error' || circuitState === 'open') return 'اختلال API'
  if (status === 'disconnected') return 'قطع شده'
  return 'متصل و پایدار'
}

function healthStatusColor(status: string, circuitState: string): string {
  if (status === 'expired') return 'text-warning bg-warning-tint border-warning-soft'
  if (status === 'error' || circuitState === 'open')
    return 'text-danger bg-danger-tint border-danger-soft'
  if (status === 'disconnected') return 'text-ink-secondary bg-surface-subtle border-border'
  return 'text-success bg-success-tint border-success-soft'
}

export const channelsService = new ChannelsService()
