/**
 * POST /api/platforms/[id]/validate — test connection by calling getMe.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'
import { validateId } from '@/lib/validations'
import { decrypt } from '@/lib/crypto'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const id = idCheck.data

  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const platform = await db.platform.findFirst({ where: { id, workspaceId } })
  if (!platform) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  if (!platform.tokenSecret) {
    return NextResponse.json({ error: 'توکن تنظیم نشده است' }, { status: 400 })
  }

  let valid = false
  let botInfo: any = null
  const token = decrypt(platform.tokenSecret)

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
    valid = true
  }

  // Update platform status
  await db.platform.update({
    where: { id },
    data: {
      status: valid ? 'active' : 'error',
      lastError: valid ? null : 'اعتبارسنجی ناموفق',
    },
  })

  return NextResponse.json({
    valid,
    botInfo: botInfo ? { username: botInfo.username, firstName: botInfo.first_name } : null,
  })
}
