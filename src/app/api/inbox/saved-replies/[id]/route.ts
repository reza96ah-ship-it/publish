import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { updateSavedReply, deleteSavedReply } from '@/modules/inbox/saved-replies'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('inbox.snippets')
  if (guard.error) return guard.error
  try {
    const { id } = await params
    const body = await req.json()
    const reply = await updateSavedReply(id, guard.workspaceId, body)
    return NextResponse.json(reply)
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('inbox.snippets')
  if (guard.error) return guard.error
  try {
    const { id } = await params
    await deleteSavedReply(id, guard.workspaceId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 })
  }
}
