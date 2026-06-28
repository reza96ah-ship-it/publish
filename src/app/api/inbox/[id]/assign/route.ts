/**
 * POST /api/inbox/[id]/assign — assign an inbox message to a team member.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'
import { validateBody, inboxAssignSchema, validateId } from '@/lib/validations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const id = idCheck.data

  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id

  const body = await req.json().catch(() => ({}))
  const validation = validateBody(inboxAssignSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { assigneeId } = validation.data

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId },
  })
  if (!message) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  // If assigneeId is provided, verify the member belongs to this workspace
  if (assigneeId) {
    const member = await db.workspaceMember.findFirst({
      where: { id: assigneeId, workspaceId },
    })
    if (!member) return NextResponse.json({ error: 'member not found' }, { status: 404 })
  }

  const updated = await db.inboxMessage.update({
    where: { id },
    data: { assigneeId: assigneeId ?? null },
  })

  return NextResponse.json({
    ok: true,
    assigneeId: updated.assigneeId,
  })
}
