/**
 * POST /api/ai/caption — Streaming Persian caption generation.
 *
 * Sends SSE heartbeat immediately + every 2s during reasoning to prevent
 * gateway 502 timeouts. Supports role, goal, length, variation params.
 */

import { NextRequest } from 'next/server'
import {
  streamCaption,
  type Platform,
  type Tone,
  type CreatorRole,
  type ContentGoal,
  type CaptionLength,
} from '@/lib/ai/gemini'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, aiCaptionSchema } from '@/lib/validations'
import { aiRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 120


export async function POST(req: NextRequest) {
  // Permission guard: content.create required
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  try {
    // Rate limit: 15 AI requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { success: rateOk } = await aiRateLimit(ip)
    if (!rateOk) {
      return Response.json(
        {
          error: 'تعداد درخواست‌ها زیاد است — یک دقیقه صبر کنید',
        },
        { status: 429 }
      )
    }

    const raw = await req.json().catch(() => null)
    if (!raw)
      return Response.json({ error: 'بدنه درخواست نامعتبر' }, { status: 400 })

    const validation = validateBody(aiCaptionSchema, raw)
    if (!validation.success) {
      return Response.json({ error: validation.error }, { status: 400 })
    }
    const { topic, platform, tone, role, goal, length, variation } = validation.data

    const validTone = tone as Tone | undefined
    const validRole = role as CreatorRole | undefined
    const validGoal = goal as ContentGoal | undefined
    const validLength = length as CaptionLength | undefined
    const variationNum = variation ?? 0

    // Workspace context from permission guard
    const workspace = guard.workspace

    // Create SSE stream with heartbeat
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        // Send immediate heartbeat to prevent gateway timeout
        controller.enqueue(encoder.encode(': heartbeat\n\n'))

        // Start heartbeat interval (every 2s)
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            clearInterval(heartbeatInterval)
          }
        }, 2000)

        try {
          // Send thinking status
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: 'thinking' })}\n\n`))

          let firstChunk = true
          for await (const chunk of streamCaption(
            topic,
            platform as Platform,
            workspace,
            validTone as Tone | undefined,
            validRole as CreatorRole | undefined,
            validGoal as ContentGoal | undefined,
            validLength as CaptionLength | undefined,
            variationNum
          )) {
            if (firstChunk) {
              // Send streaming status before first content
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ status: 'streaming' })}\n\n`)
              )
              firstChunk = false
            }
            const data = JSON.stringify({ content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err: unknown) {
          // Log the full error server-side for debugging, but send a generic
          // Persian message to the client to avoid leaking internal details
          // (e.g., "GapGPT 401: Invalid API key").
          // eslint-disable-next-line no-console
          console.error('[ai/caption] stream error:', err)
          const errorData = JSON.stringify({
            error: 'خطا در تولید کپشن. لطفاً دوباره تلاش کنید.',
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
        } finally {
          clearInterval(heartbeatInterval)
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err: unknown) {
    // Log the full error server-side, return generic Persian message to client
    // eslint-disable-next-line no-console
    console.error('[ai/caption] route error:', err)
    return Response.json(
      {
        error: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.',
      },
      { status: 500 }
    )
  }
}
