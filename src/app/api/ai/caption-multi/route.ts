/**
 * POST /api/ai/caption-multi — multi-platform parallel caption generation.
 *
 * Accepts { topic, platforms[], tone, role, goal, length } and generates
 * one adapted caption per platform in parallel. Multiplexes results into
 * a single SSE stream with a `platform` field on each event.
 *
 * Issue #200: thin handler. SSE protocol + parallel generation lives in
 * src/modules/ai/service.ts.
 */

import { NextRequest } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { aiRateLimit } from '@/lib/ratelimit'
import { aiService, VALID_PLATFORMS, type WorkspaceContext } from '@/modules/ai'
import type { Platform } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown'
  const { success: rateOk } = await aiRateLimit(ip)
  if (!rateOk) {
    return Response.json({ error: 'تعداد درخواست‌ها زیاد است — یک دقیقه صبر کنید' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { topic, platforms, tone, role, goal, length } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return Response.json({ error: 'موضوع حداقل ۳ کاراکتر باید باشد' }, { status: 400 })
    }

    const validPlatforms = (platforms as string[]).filter((p) =>
      VALID_PLATFORMS.includes(p as Platform)
    )
    if (validPlatforms.length < 2 || validPlatforms.length > 4) {
      return Response.json({ error: '۲ تا ۴ پلتفرم انتخاب کنید' }, { status: 400 })
    }

    return aiService.streamCaptionMulti({
      topic,
      platforms: validPlatforms,
      tone,
      role,
      goal,
      length,
      workspace: guard.workspace as WorkspaceContext | undefined,
    })
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ai/caption-multi] route error:', err)
    return Response.json({ error: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
