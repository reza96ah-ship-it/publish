/**
 * POST /api/ai/hashtags — Persian hashtag suggestion.
 *
 * Request body: { topic: string, platform: Platform, existingHashtags?: string }
 * Response: { hashtags: string[] }
 *
 * Uses z-ai-web-dev-sdk to generate 10 relevant Persian + English hashtags.
 */

import { NextRequest } from "next/server";
import { suggestHashtags, type Platform } from "@/lib/ai/zai";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_PLATFORMS: Platform[] = [
  "instagram",
  "telegram",
  "linkedin",
  "rubika",
  "bale",
  "eitaa",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, platform, existingHashtags } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return Response.json({ error: "موضوع حداقل ۳ کاراکتر باید باشد" }, { status: 400 });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return Response.json({ error: "پلتفرم نامعتبر" }, { status: 400 });
    }

    const hashtags = await suggestHashtags(
      topic,
      platform as Platform,
      existingHashtags,
    );

    return Response.json({ hashtags });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
