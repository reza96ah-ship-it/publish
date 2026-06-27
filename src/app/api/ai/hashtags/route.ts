/**
 * POST /api/ai/hashtags â€” Persian hashtag suggestion with explanations.
 *
 * Returns { hashtags: { tag, reason }[] }.
 */

import { NextRequest } from "next/server";
import { suggestHashtags, type Platform, type CreatorRole, type ContentGoal } from "@/lib/ai/gemini";
import { validateBody, aiHashtagsSchema } from "@/lib/validations";

export const dynamic = 'force-dynamic'

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return Response.json({ error: "ط¨ط¯ظ†ظ‡ ظ†ط§ظ…ط¹طھط¨ط±" }, { status: 400 });

    const validation = validateBody(aiHashtagsSchema, body);
    if (!validation.success) return Response.json({ error: validation.error }, { status: 400 });

    const { topic, platform, existingHashtags, role, goal } = validation.data;

    const hashtags = await suggestHashtags(
      topic,
      platform as Platform,
      existingHashtags,
      role as CreatorRole | undefined,
      goal as ContentGoal | undefined,
    );

    return Response.json({ hashtags });
  } catch (err: any) {
    console.error("[ai/hashtags] error:", err);
    return Response.json(
      { error: "ط®ط·ط§ ط¯ط± طھظˆظ„غŒط¯ ظ‡ط´طھع¯. ظ„ط·ظپط§ظ‹ ط¯ظˆط¨ط§ط±ظ‡ طھظ„ط§ط´ ع©ظ†غŒط¯." },
      { status: 500 },
    );
  }
}
