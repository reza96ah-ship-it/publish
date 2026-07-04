import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UtmPresetService } from '@/modules/utm/service'

const svc = new UtmPresetService()

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    const body = await req.json()
    const updated = await svc.update(id, session.user.workspaceId, body)
    return NextResponse.json(updated)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.workspaceId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { id } = await params
    await svc.delete(id, session.user.workspaceId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    const status = msg === 'NOT_FOUND' ? 404 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
