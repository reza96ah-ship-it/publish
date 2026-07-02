/**
 * GET /api/ai/drafts — list AI-saved caption drafts.
 * POST /api/ai/drafts — save a new draft.
 *
 * Reuses the Content model with status='draft' and internalNote='[ai-draft]{...metadata}'.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, aiDraftSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

// GET — list drafts
export async function GET() {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const items = await db.content.findMany({
    where: {
      workspaceId,
      status: 'draft',
      internalNote: { startsWith: '[ai-draft]' },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  })

  return NextResponse.json(
    items.map((c) => {
      let meta: Record<string, unknown> = {}
      try {
        const metaStr = (c.internalNote ?? '').replace('[ai-draft]', '')
        meta = JSON.parse(metaStr)
      } catch {}

      return {
        id: c.id,
        title: c.title,
        body: c.body ?? '',
        hashtags: c.hashtags ?? '',
        platform: meta.platform ?? null,
        tone: meta.tone ?? null,
        role: meta.role ?? null,
        goal: meta.goal ?? null,
        length: meta.length ?? null,
        authorName: c.authorName ?? 'دستیار هوش مصنوعی',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }
    })
  )
}

// POST — save a new draft
export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = validateBody(aiDraftSchema, body)
  if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 })
  const { title, body: captionBody, hashtags, platform, tone, role, goal, length } = validation.data

  // Zod min(1) catches empty string; also reject whitespace-only to preserve old behavior.
  if (!captionBody.trim()) {
    return NextResponse.json({ error: 'متن کپشن خالی است' }, { status: 400 })
  }

  // Derive title from first non-empty line if not provided
  const derivedTitle =
    title?.trim() ||
    captionBody
      .split('\n')
      .find((l: string) => l.trim())
      ?.slice(0, 60) ||
    'پیش‌نویس کپشن'

  const meta = JSON.stringify({ platform, tone, role, goal, length })

  const content = await db.content.create({
    data: {
      workspaceId,
      title: derivedTitle,
      body: captionBody,
      hashtags: hashtags || null,
      status: 'draft',
      authorName: 'دستیار هوش مصنوعی',
      internalNote: `[ai-draft]${meta}`,
    },
  })

  return NextResponse.json(
    {
      id: content.id,
      title: content.title,
      body: content.body,
      hashtags: content.hashtags,
      platform,
      tone,
      role,
      goal,
      length,
      authorName: content.authorName,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    },
    { status: 201 }
  )
}
