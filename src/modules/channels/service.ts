/**
 * Channels domain module — service layer.
 * Business logic for platform (channel) lifecycle: list, connect, validate.
 * No HTTP. No direct Prisma.
 */

import { db } from '@/lib/db'
import { encrypt, decrypt } from '@/lib/crypto'
import { getProviderAuthAdapter } from '@/lib/provider-auth'
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
}

export const channelsService = new ChannelsService()
