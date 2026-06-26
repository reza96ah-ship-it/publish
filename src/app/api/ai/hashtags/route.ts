/**
 * POST /api/ai/hashtags — Persian hashtag suggestion with explanations.
 *
 * Returns { hashtags: { tag, reason }[] }.
 */

import { NextRequest } from "next/server";
import { suggestHashtags, type Platform, type CreatorRole, type ContentGoal } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

const VALID_PLATFORMS: Platform[] = ["instagram", "telegram", "linkedin", "rubika", "bale", "eitaa"];
const VALID_ROLES = ["influencer", "store", "reviewer", "educator", "brand", "news", "community"] as const;
const VALID_GOALS = ["sell", "educate", "review", "announce", "engage", "inspire"] as const;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { topic, platform, existingHashtags, role, goal } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length < 3) {
      return Response.json({ error: "موضوع حداقل ۳ کاراکتر باید باشد" }, { status: 400 });
    }
    if (!VALID_PLATFORMS.includes(platform)) {
      return Response.json({ error: "پلتفرم نامعتبر" }, { status: 400 });
    }

    const validRole = role && VALID_ROLES.includes(role as any) ? role : undefined;
    const validGoal = goal && VALID_GOALS.includes(goal as any) ? goal : undefined;

    const hashtags = await suggestHashtags(
      topic,
      platform as Platform,
      existingHashtags,
      validRole as CreatorRole | undefined,
      validGoal as ContentGoal | undefined,
    );

    return Response.json({ hashtags });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
