import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId } from '@/lib/validations'
import {
  getPrivateCommentReplyState, PrivateCommentReplyError, sendPrivateCommentReply,
} from '@/modules/inbox/private-comment-reply'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({ message: z.string().trim().min(1).max(1000) }).strict()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  try {
    return NextResponse.json(await getPrivateCommentReplyState(guard.workspaceId, idCheck.data))
  } catch (error) {
    if (error instanceof PrivateCommentReplyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    throw error
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const raw = await req.json().catch(() => null)
  const validation = validateBody(bodySchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  try {
    const result = await sendPrivateCommentReply(
      { workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data,
      validation.data.message,
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof PrivateCommentReplyError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode })
    }
    throw error
  }
}
