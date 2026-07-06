import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { contentService, ContentNotFoundError, InvalidStateTransitionError } from '@/modules/content'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('content.edit')
  if (guard.error) return guard.error

  try {
    const result = await contentService.submitForReview(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ContentNotFoundError) return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    if (err instanceof InvalidStateTransitionError) {
      return NextResponse.json({ error: 'invalid_transition', message: err.message }, { status: 400 })
    }
    throw err
  }
}
