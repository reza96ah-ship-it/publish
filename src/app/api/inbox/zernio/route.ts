import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { logger } from '@/lib/logger'
import { ZernioApiError } from '@/lib/zernio'
import { listWorkspaceZernioConversations } from '@/modules/inbox/zernio-read'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
  if (cursor && (cursor.length > 500 || /[\u0000-\u001f]/.test(cursor))) {
    return NextResponse.json({ error: 'invalid_cursor' }, { status: 400 })
  }
  try {
    const result = await listWorkspaceZernioConversations(guard.workspaceId, cursor)
    return NextResponse.json(result)
  } catch (error) {
    logger.error({ msg: 'Zernio inbox list failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return NextResponse.json({ error: 'zernio_unavailable' }, { status: 502 })
  }
}
