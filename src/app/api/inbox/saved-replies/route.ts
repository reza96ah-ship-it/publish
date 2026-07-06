import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { validateBody, savedReplyCreateSchema } from '@/lib/validations'
import { listSavedReplies, createSavedReply } from '@/modules/inbox/saved-replies'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  const replies = await listSavedReplies(guard.workspaceId)
  return NextResponse.json(replies)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('inbox.snippets')
  if (guard.error) return guard.error
  const session = await getServerSession(authOptions)
  try {
    const raw = await req.json().catch(() => null)
    if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
    const validation = validateBody(savedReplyCreateSchema, raw)
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
    const reply = await createSavedReply(guard.workspaceId, session?.user?.id ?? '', validation.data)
    return NextResponse.json(reply, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
