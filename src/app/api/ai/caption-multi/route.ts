/**
 * POST /api/ai/caption-multi â€” multi-platform parallel caption generation.
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
import { getWorkspace } from '@/lib/server'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 120

const VALID_PLATFORMS: Platform[] = ['instagram', 'telegram', 'linkedin', 'rubika', 'bale', 'eitaa']

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { topic, platforms, tone, role, goal, length } = body

    if (!topic || typeof topic !== 'string' || topic.trim().length < 3) {
      return Response.json(
        { error: 'ظ…ظˆط¶ظˆط¹ ط­ط¯ط§ظ‚ظ„ غ³ ع©ط§ط±ط§ع©طھط± ط¨ط§غŒط¯ ط¨ط§ط´ط¯' },
        { status: 400 }
      )
    }

    const validPlatforms = (platforms as string[]).filter((p) =>
      VALID_PLATFORMS.includes(p as Platform)
    )
    if (validPlatforms.length < 2 || validPlatforms.length > 4) {
      return Response.json(
        { error: 'غ² طھط§ غ´ ظ¾ظ„طھظپط±ظ… ط§ظ†طھط®ط§ط¨ ع©ظ†غŒط¯' },
        { status: 400 }
      )
    }

    let workspace: Awaited<ReturnType<typeof getWorkspace>> = null
    try {
      workspace = await getWorkspace()
    } catch {}

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
              workspace ?? undefined,
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
                `data: ${JSON.stringify({ error: 'ط®ط·ط§ ط¯ط± طھظˆظ„غŒط¯ ع©ظ¾ط´ظ†. ظ„ط·ظپط§ظ‹ ط¯ظˆط¨ط§ط±ظ‡ طھظ„ط§ط´ ع©ظ†غŒط¯.', platform: p })}\n\n`
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
        error:
          'ط®ط·ط§ ط¯ط± ظ¾ط±ط¯ط§ط²ط´ ط¯ط±ط®ظˆط§ط³طھ. ظ„ط·ظپط§ظ‹ ط¯ظˆط¨ط§ط±ظ‡ طھظ„ط§ط´ ع©ظ†غŒط¯.',
      },
      { status: 500 }
    )
  }
}
