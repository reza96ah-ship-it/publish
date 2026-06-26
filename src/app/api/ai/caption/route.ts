/**
 * POST /api/ai/caption — Streaming Persian caption generation.
 *
 * Sends SSE heartbeat immediately + every 2s during reasoning to prevent
 * gateway 502 timeouts. Supports role, goal, length, variation params.
 */

import { NextRequest } from "next/server";
import { streamCaption, type Platform, type Tone, type CreatorRole, type ContentGoal, type CaptionLength } from "@/lib/ai/gemini";
import { getWorkspace } from "@/lib/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const VALID_PLATFORMS: Platform[] = ["instagram", "telegram", "linkedin", "rubika", "bale", "eitaa"];
const VALID_TONES = ["formal", "friendly", "professional", "storytelling", "sales", "educational", "poetic"] as const;
const VALID_ROLES = ["influencer", "store", "reviewer", "educator", "brand", "news", "community"] as const;
const VALID_GOALS = ["sell", "educate", "review", "announce", "engage", "inspire"] as const;
const VALID_LENGTHS = ["short", "standard", "long"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, platform, tone, role, goal, length, variation } = body;

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
    const validRole = role && VALID_ROLES.includes(role as any) ? role : undefined;
    const validGoal = goal && VALID_GOALS.includes(goal as any) ? goal : undefined;
    const validLength = length && VALID_LENGTHS.includes(length as any) ? length : undefined;
    const variationNum = typeof variation === "number" ? Math.max(0, Math.floor(variation)) : 0;

    // Get workspace context
    let workspace: Awaited<ReturnType<typeof getWorkspace>> = null;
    try {
      workspace = await getWorkspace();
    } catch {
      // Demo mode
    }

    // Create SSE stream with heartbeat
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send immediate heartbeat to prevent gateway timeout
        controller.enqueue(encoder.encode(": heartbeat\n\n"));

        // Start heartbeat interval (every 2s)
        const heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(": keepalive\n\n"));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 2000);

        try {
          // Send thinking status
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "thinking" })}\n\n`));

          let firstChunk = true;
          for await (const chunk of streamCaption(
            topic,
            platform as Platform,
            workspace ?? undefined,
            validTone as Tone | undefined,
            validRole as CreatorRole | undefined,
            validGoal as ContentGoal | undefined,
            validLength as CaptionLength | undefined,
            variationNum,
          )) {
            if (firstChunk) {
              // Send streaming status before first content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: "streaming" })}\n\n`));
              firstChunk = false;
            }
            const data = JSON.stringify({ content: chunk });
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err: any) {
          const errorData = JSON.stringify({ error: err.message });
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        } finally {
          clearInterval(heartbeatInterval);
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
