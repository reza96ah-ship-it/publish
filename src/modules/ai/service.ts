/**
 * Issue #200: AI domain module — service layer.
 *
 * Business logic for AI caption streaming + saved drafts. Encapsulates the
 * SSE heartbeat/encoding protocol and the Content-as-draft persistence so
 * route handlers stay thin (auth → rate-limit → validate → service → response).
 *
 * No Next.js transport imports — only Web-standard `Response`/`ReadableStream`.
 */

import { db } from '@/lib/db'
import {
  streamCaption,
  type Platform,
  type Tone,
  type CreatorRole,
  type ContentGoal,
  type CaptionLength,
  type WorkspaceContext,
} from '@/lib/ai/gemini'
import type {
  CaptionStreamInput,
  CaptionMultiStreamInput,
  DraftItem,
  SaveDraftInput,
  SaveDraftResult,
  AuthContext,
} from './types'

const VALID_PLATFORMS: Platform[] = [
  'instagram', 'telegram', 'linkedin', 'rubika', 'bale', 'eitaa',
]

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

const SSE_HEADERS_MULTI = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
} as const

const GENERIC_ERROR_MSG = 'خطا در تولید کپشن. لطفاً دوباره تلاش کنید.'

function sse(encoder: TextEncoder, controller: ReadableStreamDefaultController, payload: unknown) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
}

function startHeartbeat(encoder: TextEncoder, controller: ReadableStreamDefaultController) {
  controller.enqueue(encoder.encode(': heartbeat\n\n'))
  const id = setInterval(() => {
    try {
      controller.enqueue(encoder.encode(': keepalive\n\n'))
    } catch {
      clearInterval(id)
    }
  }, 2000)
  return id
}

export class AIService {
  /**
   * POST /api/ai/caption — single-platform streaming caption generation.
   * Returns a Response with an SSE body: thinking → streaming chunks → [DONE].
   */
  streamCaption(input: CaptionStreamInput): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
        const heartbeat = startHeartbeat(encoder, controller)
        try {
          sse(encoder, controller, { status: 'thinking' })
          let firstChunk = true
          for await (const chunk of streamCaption(
            input.topic,
            input.platform as Platform,
            input.workspace,
            input.tone as Tone | undefined,
            input.role as CreatorRole | undefined,
            input.goal as ContentGoal | undefined,
            input.length as CaptionLength | undefined,
            input.variation ?? 0,
          )) {
            if (firstChunk) {
              sse(encoder, controller, { status: 'streaming' })
              firstChunk = false
            }
            sse(encoder, controller, { content: chunk })
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err: unknown) {
          // eslint-disable-next-line no-console
          console.error('[ai/caption] stream error:', err)
          sse(encoder, controller, { error: GENERIC_ERROR_MSG })
        } finally {
          clearInterval(heartbeat)
          controller.close()
        }
      },
    })
    return new Response(stream, { headers: SSE_HEADERS })
  }

  /**
   * POST /api/ai/caption-multi — multi-platform parallel streaming.
   * Multiplexes per-platform events (each event carries a `platform` field).
   */
  streamCaptionMulti(input: CaptionMultiStreamInput): Response {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
        const heartbeat = startHeartbeat(encoder, controller)

        const generators = input.platforms.map(async (p) => {
          try {
            sse(encoder, controller, { status: 'thinking', platform: p })
            let first = true
            for await (const chunk of streamCaption(
              input.topic,
              p as Platform,
              input.workspace,
              input.tone as Tone | undefined,
              input.role as CreatorRole | undefined,
              input.goal as ContentGoal | undefined,
              input.length as CaptionLength | undefined,
            )) {
              if (first) {
                sse(encoder, controller, { status: 'streaming', platform: p })
                first = false
              }
              sse(encoder, controller, { content: chunk, platform: p })
            }
            sse(encoder, controller, { done: true, platform: p })
          } catch (err: unknown) {
            const safePlatform = String(p).replace(/[\n\r]/g, '')
            // eslint-disable-next-line no-console
            console.error('[ai/caption-multi] stream error for %s:', safePlatform, err)
            sse(encoder, controller, { error: GENERIC_ERROR_MSG, platform: p })
          }
        })

        await Promise.all(generators)
        clearInterval(heartbeat)
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
      },
    })
    return new Response(stream, { headers: SSE_HEADERS_MULTI })
  }

  /**
   * GET /api/ai/drafts — list AI-saved caption drafts.
   * Reuses the Content model with status='draft' and an `[ai-draft]` metadata prefix.
   */
  async listDrafts(auth: AuthContext, limit = 50): Promise<DraftItem[]> {
    const items = await db.content.findMany({
      where: {
        workspaceId: auth.workspaceId,
        status: 'draft',
        internalNote: { startsWith: '[ai-draft]' },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
    })

    return items.map((c) => {
      let meta: Record<string, unknown> = {}
      try {
        meta = JSON.parse((c.internalNote ?? '').replace('[ai-draft]', ''))
      } catch { /* invalid JSON — keep empty meta */ }
      return {
        id: c.id,
        title: c.title,
        body: c.body ?? '',
        hashtags: c.hashtags ?? '',
        platform: (meta.platform as string | null) ?? null,
        tone: (meta.tone as string | null) ?? null,
        role: (meta.role as string | null) ?? null,
        goal: (meta.goal as string | null) ?? null,
        length: (meta.length as string | null) ?? null,
        authorName: c.authorName ?? 'دستیار هوش مصنوعی',
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }
    })
  }

  /**
   * POST /api/ai/drafts — save a new AI-generated draft.
   * Derives a title from the first non-empty line if not provided.
   */
  async saveDraft(auth: AuthContext, input: SaveDraftInput): Promise<SaveDraftResult> {
    const { title, body: captionBody, hashtags, platform, tone, role, goal, length } = input

    const derivedTitle =
      title?.trim() ||
      captionBody.split('\n').find((l: string) => l.trim())?.slice(0, 60) ||
      'پیش‌نویس کپشن'

    const meta = JSON.stringify({ platform, tone, role, goal, length })
    const content = await db.content.create({
      data: {
        workspaceId: auth.workspaceId,
        title: derivedTitle,
        body: captionBody,
        hashtags: hashtags || null,
        status: 'draft',
        authorName: 'دستیار هوش مصنوعی',
        internalNote: `[ai-draft]${meta}`,
      },
    })

    return {
      id: content.id,
      title: content.title,
      body: content.body ?? '',
      hashtags: content.hashtags,
      platform,
      tone,
      role,
      goal,
      length,
      authorName: content.authorName,
      createdAt: content.createdAt,
      updatedAt: content.updatedAt,
    }
  }
}

export const aiService = new AIService()

// Re-exported for the route handler's platform validation
export { VALID_PLATFORMS }
export type { WorkspaceContext }
