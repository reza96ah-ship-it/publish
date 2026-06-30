/**
 * POST /api/ai/hashtags — Persian hashtag suggestion with explanations.
 *
 * Returns { hashtags: { tag, reason }[] }.
 */

import { NextRequest } from 'next/server'
import { suggestHashtags, type Platform, type CreatorRole, type ContentGoal } from '@/lib/ai/gemini'
import { validateBody, aiHashtagsSchema } from '@/lib/validations'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: NextRequest) {
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
  } catch (err: any) {
    console.error('[ai/hashtags] error:', err)
    return Response.json(
      { error: 'خطا در تولید هشتگ. لطفاً دوباره تلاش کنید.' },
      { status: 500 }
    )
  }
}
