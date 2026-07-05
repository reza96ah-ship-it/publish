import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAnyPermissionApi, requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateParams, contentListQuerySchema, cursorPaginationSchema } from '@/lib/validations'
import { contentService } from '@/modules/content'
import {
  publicationsService,
  mapPublishError,
  resolveAuthorName,
  resolveUserId,
  type AuthContext,
} from '@/modules/publications'
import { startTrace } from '@/lib/tracing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requireAnyPermissionApi(['content.create', 'content.review'])
  if (guard.error) return guard.error

  const query = Object.fromEntries(req.nextUrl.searchParams.entries())
  const queryCheck = validateParams(contentListQuerySchema.merge(cursorPaginationSchema), query)
  if (!queryCheck.success) return NextResponse.json({ error: queryCheck.error }, { status: 400 })

  const result = await contentService.listContent(
    { workspaceId: guard.workspaceId, userId: guard.userId },
    queryCheck.data
  )
  return NextResponse.json(result)
}

/**
 * POST /api/content — create a new content draft.
 *
 * Thin transport handler: auth → validate → publicationsService.create()
 * (mode='draft') → map. The publications service owns all business logic
 * (channel resolution, transactional content+revision+outbox creation).
 *
 * Request:  { title: string, campaignId?: string }
 * Response: { id: string }   (201 Created)
 */
const contentCreateSchema = z.object({
  title: z
    .string({ error: 'عنوان الزامی است' })
    .trim()
    .min(1, 'عنوان الزامی است')
    .max(200, 'عنوان نباید از ۲۰۰ کاراکتر بیشتر باشد'),
  campaignId: z.string().uuid('شناسه کمپین نامعتبر است').optional(),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(contentCreateSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })

  const [authorName, userId] = await Promise.all([resolveAuthorName(), resolveUserId()])
  const trace = startTrace('content.create')
  const auth: AuthContext = {
    workspaceId: guard.workspaceId,
    userId,
    authorName,
    role: guard.role,
    trace,
  }

  try {
    const result = await publicationsService.create(auth, {
      title: validation.data.title,
      mode: 'draft',
      scheduleMode: 'now',
      mediaIds: [],
      campaignId: validation.data.campaignId,
    })
    return NextResponse.json({ id: result.contentId }, { status: 201 })
  } catch (err) {
    const mapped = mapPublishError(err, auth.workspaceId, trace)
    return NextResponse.json({ error: mapped.error }, { status: mapped.status })
  }
}
