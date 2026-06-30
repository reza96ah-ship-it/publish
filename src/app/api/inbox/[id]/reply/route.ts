/**
 * POST /api/inbox/[id]/reply — reply to an inbox message.
 * Marks the message as replied + stores the reply text.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, inboxReplySchema } from '@/lib/validations'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(inboxReplySchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }
  const { reply } = validation.data

  const message = await db.inboxMessage.findFirst({
    where: { id, workspaceId },
  })
  if (!message) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  const updated = await db.inboxMessage.update({
    where: { id },
    data: {
      reply: reply.trim(),
      isReplied: true,
      isRead: true,
    },
  })

  return NextResponse.json({
    ok: true,
    reply: updated.reply,
    isReplied: updated.isReplied,
  })
}
