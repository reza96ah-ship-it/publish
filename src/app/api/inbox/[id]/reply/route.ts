import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, inboxReplySchema } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError, ProviderReplyError } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(inboxReplySchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await inboxService.replyToMessage(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      id,
      { reply: validation.data.reply }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError) return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    if (err instanceof ProviderReplyError) return NextResponse.json({ error: err.message }, { status: 502 })
    throw err
  }
}
