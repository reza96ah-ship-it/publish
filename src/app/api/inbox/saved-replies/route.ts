import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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
    const body = await req.json()
    const reply = await createSavedReply(guard.workspaceId, session?.user?.id ?? '', body)
    return NextResponse.json(reply, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
