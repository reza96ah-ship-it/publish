/**
 * POST /api/ai/caption-multi — multi-platform parallel caption generation.
 *
 * Accepts { topic, platforms[], tone, role, goal, length } and generates
 * one adapted caption per platform in parallel. Multiplexes results into
 * a single SSE stream with a `platform` field on each event.
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

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 120

const VALID_PLATFORMS: Platform[] = ['instagram', 'telegram', 'linkedin', 'rubika', 'bale', 'eitaa']

export async function POST(req: NextRequest) {
  // Permission guard: content.create required
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error

  try {
    const body = await req.json()
    const { topic, platforms, tone, role, goal, length } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return Response.json(
        { error: 'موضوع حداقل ۳ کاراکتر باید باشد' },
        { status: 400 }
      )
    }

    const validPlatforms = (platforms as string[]).filter((p) =>
      VALID_PLATFORMS.includes(p as Platform)
    )
    if (validPlatforms.length < 2 || validPlatforms.length > 4) {
      return Response.json(
        { error: '۲ تا ۴ پلتفرم انتخاب کنید' },
        { status: 400 }
      )
    }

    const workspace = guard.workspace

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'))
          } catch {
            clearInterval(heartbeat)
          }
        }, 2000)

        // Launch parallel generators
        const generators = validPlatforms.map(async (p) => {
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ status: 'thinking', platform: p })}\n\n`)
            )
            let first = true
            for await (const chunk of streamCaption(
              topic,
              p as Platform,
              workspace,
              tone as Tone | undefined,
              role as CreatorRole | undefined,
              goal as ContentGoal | undefined,
              length as CaptionLength | undefined
            )) {
              if (first) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ status: 'streaming', platform: p })}\n\n`
                  )
                )
                first = false
              }
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: chunk, platform: p })}\n\n`)
              )
            }
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ done: true, platform: p })}\n\n`)
            )
          } catch (err: any) {
            console.error(`[ai/caption-multi] stream error for ${p}:`, err)
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: 'خطا در تولید کپشن. لطفاً دوباره تلاش کنید.', platform: p })}\n\n`
              )
            )
          }
        })

        await Promise.all(generators)
        clearInterval(heartbeat)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err: any) {
    console.error('[ai/caption-multi] route error:', err)
    return Response.json(
      {
        error: 'خطا در پردازش درخواست. لطفاً دوباره تلاش کنید.',
      },
      { status: 500 }
    )
  }
}
