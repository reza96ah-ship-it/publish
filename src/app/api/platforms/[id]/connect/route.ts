/**
 * POST /api/platforms/[id]/connect — save bot token + chat ID for a platform.
 * Validates the token by calling the platform's getMe endpoint.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, platformConnectSchema } from '@/lib/validations'
import { ensureEncrypted } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // Issue #142: connecting platform credentials requires platform.connect permission (admin-only)
  const guard = await requirePermissionApi('platform.connect')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(platformConnectSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { token, targetId, name } = validation.data

  // Verify platform belongs to workspace
  const platform = await db.platform.findFirst({ where: { id, workspaceId } })
  if (!platform) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // Validate token by calling the platform's getMe endpoint
  let valid = false
  let botInfo: any = null

  if (platform.type === 'telegram') {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`)
      const data = await res.json()
      valid = data.ok
      botInfo = data.result
    } catch {}
  } else if (platform.type === 'bale') {
    try {
      const res = await fetch(`https://tapi.bale.ai/bot${token}/getMe`)
      const data = await res.json()
      valid = data.ok
      botInfo = data.result
    } catch {}
  } else if (platform.type === 'rubika') {
    try {
      const res = await fetch(`https://botapi.rubika.ir/v3/${token}/getMe`, { method: 'POST' })
      const data = await res.json()
      valid = data.status === 'OK' || data.ok
      botInfo = data.data || data.result
    } catch {}
  } else {
    // For IG/LinkedIn — just save (OAuth flow would validate separately)
    valid = true
  }

  if (!valid) {
    return NextResponse.json({ error: 'توکن نامعتبر است — اتصال ناموفق بود' }, { status: 400 })
  }

  // Issue #116: Instagram long-lived access tokens expire after 60 days.
  // Record the expiry so the worker's daily scan can warn users in advance
  // (7-day + 1-day notifications) and mark expired tokens as auth errors.
  // LinkedIn tokens also expire after 60 days — same lifecycle applies.
  // Bot tokens (Telegram/Bale/Rubika) do NOT expire, so tokenExpiresAt stays null.
  const tokenExpiresAt =
    platform.type === 'instagram' || platform.type === 'linkedin'
      ? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) // 60 days
      : null

  // Save token + target to platform
  await db.platform.update({
    where: { id },
    data: {
      tokenSecret: ensureEncrypted(token),
      targetId: targetId || null,
      name: name || (botInfo?.username ? `@${botInfo.username}` : platform.name),
      username: botInfo?.username || platform.username,
      status: 'active',
      lastError: null,
      circuitState: 'closed',
      tokenExpiresAt,
      lastValidatedAt: new Date(),
    },
  })

  return NextResponse.json({
    ok: true,
    botInfo: botInfo ? { username: botInfo.username, firstName: botInfo.first_name } : null,
  })
}
