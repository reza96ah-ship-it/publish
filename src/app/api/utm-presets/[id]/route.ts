import { NextRequest, NextResponse } from 'next/server'
import { requireAnyPermissionApi } from '@/lib/auth-guards'

import { UtmPresetService } from '@/modules/utm/service'

const svc = new UtmPresetService()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await svc.update(id, guard.workspaceId, body)
    return NextResponse.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error
  try {
    const { id } = await params
    await svc.delete(id, guard.workspaceId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
