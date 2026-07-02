/**
 * POST /api/ai/hashtags — Persian hashtag suggestion with explanations.
 *
 * Returns { hashtags: { tag, reason }[] }.
 *
 * Issue #142: requires content.create permission (admin/editor only).
 */

import { NextRequest } from 'next/server'
import { suggestHashtags, type Platform, type CreatorRole, type ContentGoal } from '@/lib/ai/gemini'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, aiHashtagsSchema } from '@/lib/validations'
import { aiRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Issue #142: require content.create permission
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const { success: rateOk } = await aiRateLimit(ip)
  if (!rateOk) {
    return Response.json({ error: 'تعداد درخواست‌ها زیاد است — یک دقیقه صبر کنید' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => null)
    if (!body) return Response.json({ error: 'بدنه نامعتبر' }, { status: 400 })

    const validation = validateBody(aiHashtagsSchema, body)
    if (!validation.success) return Response.json({ error: validation.error }, { status: 400 })

    const { topic, platform, existingHashtags, role, goal } = validation.data

    const hashtags = await suggestHashtags(
      topic,
      platform as Platform,
      existingHashtags,
      role as CreatorRole | undefined,
      goal as ContentGoal | undefined
    )

    return Response.json({ hashtags })
  } catch (err: unknown) {
    console.error('[ai/hashtags] error:', err)
    return Response.json(
      { error: 'خطا در تولید هشتگ. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
