import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { inboxService, InboxMessageNotFoundError } from '@/modules/inbox'

export const dynamic = 'force-dynamic'

function normalizeTags(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null
  const tags = [...new Set(value.map((tag) => (typeof tag === 'string' ? tag.trim() : '')))]
    .filter(Boolean)
    .slice(0, 8)
  if (tags.some((tag) => tag.length > 32)) return null
  return tags
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params
  const idCheck = validateId(rawId)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })

  const guard = await requirePermissionApi('inbox.assign')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  const tags = normalizeTags(body?.tags)
  if (!tags) return NextResponse.json({ error: 'برچسب نامعتبر' }, { status: 400 })

  try {
    const result = await inboxService.updateThreadTags(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      idCheck.data,
      { tags }
    )
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof InboxMessageNotFoundError)
      return NextResponse.json({ error: 'مورد یافت نشد' }, { status: 404 })
    throw err
  }
}
