import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { toggleRule, deleteRule, updateRule } from '@/modules/automation/comment-dm'
import { parseKeywordList } from '@/modules/automation/comment-dm-shared'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error
  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }
  try {
    const { id } = await params
    const body = await req.json()

    // If only toggling isActive, use the fast path
    if (typeof body.isActive === 'boolean' && Object.keys(body).length === 1) {
      await toggleRule(id, guard.workspaceId, body.isActive)
      return NextResponse.json({ ok: true })
    }

    // Otherwise, update rule fields
    const updateData: Record<string, unknown> = {}
    if (body.isActive !== undefined) updateData.isActive = body.isActive
    if (body.dmTemplate !== undefined) updateData.dmTemplate = body.dmTemplate
    if (body.buttonText !== undefined) updateData.buttonText = body.buttonText
    if (body.buttonUrl !== undefined) updateData.buttonUrl = body.buttonUrl
    if (body.publicReply !== undefined) updateData.publicReply = body.publicReply
    if (body.optOutKeyword !== undefined) updateData.optOutKeyword = body.optOutKeyword
    if (body.freqCapHours !== undefined) updateData.freqCapHours = body.freqCapHours

    // Parse keyword lists
    if (body.keywords !== undefined) {
      updateData.keywords = Array.isArray(body.keywords)
        ? body.keywords
        : parseKeywordList(String(body.keywords))
    }
    if (body.excludeKeywords !== undefined) {
      updateData.excludeKeywords = Array.isArray(body.excludeKeywords)
        ? body.excludeKeywords
        : parseKeywordList(String(body.excludeKeywords))
    }

    await updateRule(id, guard.workspaceId, updateData)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error
  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }
  try {
    const { id } = await params
    await deleteRule(id, guard.workspaceId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 404 })
  }
}
