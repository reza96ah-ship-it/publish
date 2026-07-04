/**
 * POST /api/ai/caption — Streaming Persian caption generation.
 *
 * Sends SSE heartbeat immediately + every 2s during reasoning to prevent
 * gateway 502 timeouts. Supports role, goal, length, variation params.
 *
 * Issue #200: thin handler. SSE protocol + caption generation lives in
 * src/modules/ai/service.ts.
 */

import { NextRequest } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, aiCaptionSchema } from '@/lib/validations'
import { aiRateLimit } from '@/lib/ratelimit'
import { aiService } from '@/modules/ai'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
  const { success: rateOk } = await aiRateLimit(ip)
  if (!rateOk) {
    return Response.json({ error: 'تعداد درخواست‌ها زیاد است — یک دقیقه صبر کنید' }, { status: 429 })
  }

  try {
    const raw = await req.json().catch(() => null)
    if (!raw) return Response.json({ error: 'بدنه درخواست نامعتبر' }, { status: 400 })

    const validation = validateBody(aiCaptionSchema, raw)
    if (!validation.success) {
      return Response.json({ error: validation.error }, { status: 400 })
    }

    return aiService.streamCaption({
      topic: validation.data.topic,
      platform: validation.data.platform,
      tone: validation.data.tone,
      role: validation.data.role,
      goal: validation.data.goal,
      length: validation.data.length,
      variation: validation.data.variation ?? 0,
      workspace: guard.workspace,
    })
  } catch (err: unknown) {
    // eslint-disable-next-line no-console
    console.error('[ai/caption] route error:', err)
    return Response.json({ error: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.' }, { status: 500 })
  }
}
