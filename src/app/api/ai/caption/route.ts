/**
 * POST /api/ai/caption — Streaming Persian caption generation.
 *
 * Request body: { topic: string, platform: Platform, tone?: string }
 * Response: Server-Sent Events (SSE) stream of text chunks.
 *
 * Per R3 research: uses z-ai-web-dev-sdk (already installed) with a Persian
 * prompt that produces natural Farsi captions — not translated English.
 *
 * The stream uses SSE format: "data: {json}\n\n"
 * Each chunk: { "content": "text fragment" }
 * End: "data: [DONE]\n\n"
 */

import { NextRequest } from "next/server";
import { streamCaption, type Platform } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const VALID_PLATFORMS: Platform[] = [
  "instagram",
  "telegram",
  "linkedin",
  "rubika",
  "bale",
  "eitaa",
];

const VALID_TONES = ["formal", "friendly", "playful", "professional"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, platform, tone } = body;

    // Validate
    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return Response.json({ error: "موضوع حداقل ۳ کاراکتر باید باشد" }, { status: 400 });
    }
    if (topic.length > 280) {
      return Response.json({ error: "موضوع نباید از ۲۸۰ کاراکتر بیشتر باشد" }, { status: 400 });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return Response.json({ error: "پلتفرم نامعتبر" }, { status: 400 });
    }
    const validTone = tone && VALID_TONES.includes(tone) ? tone : undefined;

    // Get workspace context for brand voice
    let workspace: Awaited<ReturnType<typeof getWorkspace>> = null;
    try {
      workspace = await getWorkspace();
    } catch {
      // Demo mode — no workspace
    }

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of streamCaption(topic, platform as Platform, workspace ?? undefined, validTone as any)) {
            const data = JSON.stringify({ content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err: any) {
          const errorData = JSON.stringify({ error: err.message });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
