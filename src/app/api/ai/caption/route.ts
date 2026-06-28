/**
 * POST /api/ai/caption â€” Streaming Persian caption generation.
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
import { getWorkspace } from '@/lib/server'
import { validateBody, aiCaptionSchema } from '@/lib/validations'
import { aiRateLimit } from '@/lib/ratelimit'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'
export const maxDuration = 120

const VALID_PLATFORMS: Platform[] = ['instagram', 'telegram', 'linkedin', 'rubika', 'bale', 'eitaa']
const VALID_TONES = [
  'formal',
  'friendly',
  'professional',
  'storytelling',
  'sales',
  'educational',
  'poetic',
] as const
const VALID_ROLES = [
  'influencer',
  'store',
  'reviewer',
  'educator',
  'brand',
  'news',
  'community',
] as const
const VALID_GOALS = ['sell', 'educate', 'review', 'announce', 'engage', 'inspire'] as const
const VALID_LENGTHS = ['short', 'standard', 'long'] as const

export async function POST(req: NextRequest) {
  try {
    // Rate limit: 15 AI requests per minute per IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown'
    const { success: rateOk } = await aiRateLimit(ip)
    if (!rateOk) {
      return Response.json(
        {
          error:
            'طھط¹ط¯ط§ط¯ ط¯ط±ط®ظˆط§ط³طھâ€Œظ‡ط§ ط²غŒط§ط¯ ط§ط³طھ â€” غŒع© ط¯ظ‚غŒظ‚ظ‡ طµط¨ط± ع©ظ†غŒط¯',
        },
        { status: 429 }
      )
    }

    const raw = await req.json().catch(() => null)
    if (!raw)
      return Response.json({ error: 'ط¨ط¯ظ†ظ‡ ط¯ط±ط®ظˆط§ط³طھ ظ†ط§ظ…ط¹طھط¨ط±' }, { status: 400 })

    const validation = validateBody(aiCaptionSchema, raw)
    if (!validation.success) {
      return Response.json({ error: validation.error }, { status: 400 })
    }
    const { topic, platform, tone, role, goal, length, variation, voiceExamples } = validation.data

    const validTone = tone as Tone | undefined
    const validRole = role as CreatorRole | undefined
    const validGoal = goal as ContentGoal | undefined
    const validLength = length as CaptionLength | undefined
    const variationNum = variation ?? 0

    // Get workspace context
    let workspace: Awaited<ReturnType<typeof getWorkspace>> = null
    try {
      workspace = await getWorkspace()
    } catch {
      // Demo mode
    }

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
            workspace ?? undefined,
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
        } catch (err: any) {
          // Log the full error server-side for debugging, but send a generic
          // Persian message to the client to avoid leaking internal details
          // (e.g., "GapGPT 401: Invalid API key").
          console.error('[ai/caption] stream error:', err)
          const errorData = JSON.stringify({
            error: 'ط®ط·ط§ ط¯ط± طھظˆظ„غŒط¯ ع©ظ¾ط´ظ†. ظ„ط·ظپط§ظ‹ ط¯ظˆط¨ط§ط±ظ‡ طھظ„ط§ط´ ع©ظ†غŒط¯.',
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
  } catch (err: any) {
    // Log the full error server-side, return generic Persian message to client
    console.error('[ai/caption] route error:', err)
    return Response.json(
      {
        error:
          'ط®ط·ط§ ط¯ط± ظ¾ط±ط¯ط§ط²ط´ ط¯ط±ط®ظˆط§ط³طھ. ظ„ط·ظپط§ظ‹ ط¯ظˆط¨ط§ط±ظ‡ طھظ„ط§ط´ ع©ظ†غŒط¯.',
      },
      { status: 500 }
    )
  }
}
