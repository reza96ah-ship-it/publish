import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { contentService, ContentNotFoundError } from '@/modules/content'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id: rawId, commentId: rawCommentId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const commentIdCheck = validateId(rawCommentId)
  if (!commentIdCheck.success) return NextResponse.json({ error: commentIdCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('content.edit')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  if (typeof body.resolved !== 'boolean') {
    return NextResponse.json({ error: 'resolved field (boolean) required' }, { status: 400 })
  }

  try {
    await contentService.resolveComment(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      commentIdCheck.data,
      body.resolved,
    )
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof ContentNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    throw err
  }
}
