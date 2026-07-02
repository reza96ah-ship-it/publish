import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, contentRejectSchema } from '@/lib/validations'
import { contentService, ContentNotFoundError, InvalidStateTransitionError } from '@/modules/content'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const guard = await requirePermissionApi('content.review')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(contentRejectSchema, raw)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  try {
    const result = await contentService.rejectContent(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      id,
      validation.data.reason
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ContentNotFoundError) return NextResponse.json({ error: 'not_found' }, { status: 404 })
    if (err instanceof InvalidStateTransitionError) {
      return NextResponse.json({ error: 'not_in_review', message: err.message }, { status: 400 })
    }
    throw err
  }
}
