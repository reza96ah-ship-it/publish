import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { listRules, createRule } from '@/modules/automation/comment-dm'
import { parseKeywordList } from '@/modules/automation/comment-dm-shared'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error

  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const publicationId = searchParams.get('publicationId') ?? undefined

  const rules = await listRules(guard.workspaceId, publicationId)
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.publish')
  if (guard.error) return guard.error

  if (!(await isEnabled('comment_dm_beta', guard.workspaceId))) {
    return NextResponse.json({ error: 'این قابلیت در مرحله بتا است' }, { status: 403 })
  }

  try {
    const body = await req.json()

    // Parse keyword lists: accept both raw string (comma-separated) and array
    const keywords = Array.isArray(body.keywords)
      ? body.keywords
      : typeof body.keywords === 'string'
        ? parseKeywordList(body.keywords)
        : body.keyword
          ? [body.keyword]
          : []

    const excludeKeywords = Array.isArray(body.excludeKeywords)
      ? body.excludeKeywords
      : typeof body.excludeKeywords === 'string'
        ? parseKeywordList(body.excludeKeywords)
        : []

    const rule = await createRule(guard.workspaceId, {
      platformId: body.platformId,
      keywords,
      excludeKeywords,
      dmTemplate: body.dmTemplate ?? '',
      buttonText: body.buttonText ?? null,
      buttonUrl: body.buttonUrl ?? null,
      publicReply: body.publicReply ?? null,
      optOutKeyword: body.optOutKeyword,
      freqCapHours: body.freqCapHours,
      publicationId: body.publicationId ?? null,
    })
    return NextResponse.json(rule, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 })
  }
}
