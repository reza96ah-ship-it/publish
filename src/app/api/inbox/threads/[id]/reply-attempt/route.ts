import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import {
  getOpenZernioReplyAttempt,
  ReplyAttemptError,
  resolveZernioReplyAttempt,
} from '@/modules/inbox/zernio-reply-attempt'

export const dynamic = 'force-dynamic'

const resolutionSchema = z.object({
  idempotencyKey: z.uuid(),
  resolution: z.enum(['sent', 'not_sent']),
  confirmation: z.literal('checked_instagram_conversation'),
})

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  const attempt = await getOpenZernioReplyAttempt(guard.workspaceId, idCheck.data)
  const canResolve = guard.role === 'admin'
  return NextResponse.json({
    attempt: attempt ? {
      status: attempt.status,
      createdAt: attempt.createdAt,
      idempotencyKey: canResolve ? attempt.idempotencyKey : null,
    } : null,
    canResolve,
  })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  const parsed = resolutionSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: 'invalid_request' }, { status: 400 })
  try {
    await resolveZernioReplyAttempt({
      workspaceId: guard.workspaceId, threadId: idCheck.data,
      userId: guard.userId, ...parsed.data,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ReplyAttemptError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 409 })
    }
    throw error
  }
}
