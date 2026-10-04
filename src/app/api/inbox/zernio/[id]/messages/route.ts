import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { logger } from '@/lib/logger'
import { ZernioApiError } from '@/lib/zernio'
import { listWorkspaceZernioMessages } from '@/modules/inbox/zernio-read'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const { id } = await params
  const accountId = req.nextUrl.searchParams.get('accountId') ?? ''
  const cursor = req.nextUrl.searchParams.get('cursor') ?? undefined
  if (!/^[a-f\d]{24}$/i.test(accountId) || !id || id.length > 500 || /[\u0000-\u001f]/.test(id)
    || (cursor && (cursor.length > 500 || /[\u0000-\u001f]/.test(cursor)))) {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  }
  try {
    const result = await listWorkspaceZernioMessages(guard.workspaceId, accountId, id, cursor)
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZernioApiError && error.status === 404) {
      return NextResponse.json({ error: 'conversation_not_found' }, { status: 404 })
    }
    logger.error({ msg: 'Zernio inbox messages failed', code: error instanceof ZernioApiError ? error.code : 'internal_error' })
    return NextResponse.json({ error: 'zernio_unavailable' }, { status: 502 })
  }
}
