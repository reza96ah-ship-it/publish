/**
 * DELETE /api/ai/drafts/[id] — delete an AI draft.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const id = idCheck.data

  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const draft = await db.content.findFirst({
    where: { id, workspaceId, status: 'draft' },
  })
  if (!draft) return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })

  await db.content.delete({ where: { id } })

  return NextResponse.json({ ok: true, id })
}
