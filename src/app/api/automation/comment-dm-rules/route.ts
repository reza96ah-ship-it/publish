import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { isEnabled } from '@/lib/flags'
import { listRules, createRule } from '@/modules/automation/comment-dm'
import { parseKeywordList } from '@/modules/automation/comment-dm-shared'
import { validateBody, commentDmRuleCreateSchema } from '@/lib/validations'

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
    const raw = await req.json().catch(() => null)
    if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })

    // P1-2: Validate input with Zod before passing to service
    const validation = validateBody(commentDmRuleCreateSchema, raw)
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }
    const body = validation.data

    // Parse keyword lists: accept both raw string (comma-separated) and array
    const keywords = Array.isArray(raw.keywords)
      ? body.keywords
      : typeof raw.keywords === 'string'
        ? parseKeywordList(raw.keywords)
        : raw.keyword
          ? [raw.keyword]
          : body.keywords

    const excludeKeywords = Array.isArray(raw.excludeKeywords)
      ? body.excludeKeywords
      : typeof raw.excludeKeywords === 'string'
        ? parseKeywordList(raw.excludeKeywords)
        : body.excludeKeywords

    const rule = await createRule(guard.workspaceId, {
      platformId: body.platformId,
      keywords,
      excludeKeywords,
      dmTemplate: body.dmTemplate,
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
