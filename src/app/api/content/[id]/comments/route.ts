import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import {
  validateBody,
  validateParams,
  validateId,
  contentCommentSchema,
  contentCommentsQuerySchema,
} from '@/lib/validations'
import { contentService, ContentNotFoundError } from '@/modules/content'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('content.edit')
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(contentCommentsQuerySchema, query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  try {
    const comments = await contentService.listComments(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      queryCheck.data.parentId
    )
    return NextResponse.json(comments)
  } catch (err) {
    if (err instanceof ContentNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    throw err
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('content.edit')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => ({}))
  const validation = validateBody(contentCommentSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const comment = await contentService.addComment(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      { text: validation.data.text, parentId: validation.data.parentId }
    )
    return NextResponse.json(comment)
  } catch (err) {
    if (err instanceof ContentNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    throw err
  }
}
