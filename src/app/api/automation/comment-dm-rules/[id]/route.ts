import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { toggleRule, deleteRule } from '@/modules/automation/comment-dm'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error
  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }
  try {
    const { id } = await params
    const { isActive } = await req.json()
    await toggleRule(id, guard.workspaceId, Boolean(isActive))
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error
  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }
  try {
    const { id } = await params
    await deleteRule(id, guard.workspaceId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 })
  }
}
