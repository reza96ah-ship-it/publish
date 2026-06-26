/**
 * Shared Zod validation schemas for all API routes.
 *
 * Usage:
 *   import { publishSchema } from "@/lib/validations";
 *   const parsed = publishSchema.safeParse(body);
 *   if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
 *   // use parsed.data (typed)
 */

import { z } from "zod";

// ── Platform types ──────────────────────────────────────────────────────────

export const platformTypeSchema = z.enum(["instagram", "telegram", "linkedin", "rubika", "bale", "eitaa"]);

// ── Publish ─────────────────────────────────────────────────────────────────

export const publishSchema = z.object({
  title: z.string().trim().min(1, "عنوان الزامی است").max(200, "عنوان نباید از ۲۰۰ کاراکتر بیشتر باشد"),
  caption: z.string().max(5000, "کپشن خیلی طولانی است").optional().default(""),
  hashtags: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  mediaIds: z.array(z.string()).optional().default([]),
  platformTypes: z.array(platformTypeSchema).optional(),
  platformCaptions: z.record(z.string()).optional(),
  scheduleMode: z.enum(["now", "schedule", "queue"]).optional().default("now"),
  scheduleDate: z.string().optional(),
  scheduleTime: z.string().optional(),
  thumbnail: z.string().nullable().optional(),
  mode: z.enum(["publish", "review"]).optional().default("publish"),
});

// ── AI ──────────────────────────────────────────────────────────────────────

export const aiCaptionSchema = z.object({
  topic: z.string().trim().min(3, "موضوع حداقل ۳ کاراکتر باید باشد").max(1000, "موضوع خیلی طولانی است"),
  platform: platformTypeSchema,
  tone: z.enum(["formal", "friendly", "professional", "storytelling", "sales", "educational", "poetic"]).optional(),
  role: z.enum(["influencer", "store", "reviewer", "educator", "brand", "news", "community"]).optional(),
  goal: z.enum(["sell", "educate", "review", "announce", "engage", "inspire"]).optional(),
  length: z.enum(["short", "standard", "long"]).optional(),
  variation: z.number().int().min(0).optional().default(0),
  voiceExamples: z.string().max(3000).optional(),
});

export const aiHashtagsSchema = z.object({
  topic: z.string().trim().min(3, "موضوع حداقل ۳ کاراکتر باید باشد").max(1000),
  platform: platformTypeSchema,
  existingHashtags: z.string().optional(),
  role: z.enum(["influencer", "store", "reviewer", "educator", "brand", "news", "community"]).optional(),
  goal: z.enum(["sell", "educate", "review", "announce", "engage", "inspire"]).optional(),
});

export const aiDraftSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1, "متن کپشن خالی است").max(5000),
  hashtags: z.string().optional(),
  platform: z.string().optional(),
  tone: z.string().optional(),
  role: z.string().optional(),
  goal: z.string().optional(),
  length: z.string().optional(),
});

// ── Inbox ───────────────────────────────────────────────────────────────────

export const inboxReplySchema = z.object({
  reply: z.string().trim().min(1, "متن پاسخ خالی است").max(2000, "پاسخ خیلی طولانی است"),
});

export const inboxAssignSchema = z.object({
  assigneeId: z.string().nullable(),
});

// ── Content ─────────────────────────────────────────────────────────────────

export const contentRejectSchema = z.object({
  reason: z.string().trim().min(1, "دلیل رد را بنویسید").max(500, "دلیل خیلی طولانی است"),
});

export const contentCommentSchema = z.object({
  text: z.string().trim().min(1, "کامنت خالی است").max(1000, "کامنت خیلی طولانی است"),
  parentId: z.string().optional(),
});

// ── Members ─────────────────────────────────────────────────────────────────

export const memberInviteSchema = z.object({
  email: z.string().email("ایمیل معتبر وارد کنید"),
  name: z.string().max(100).optional(),
  role: z.enum(["admin", "editor", "approver", "viewer"], "نقش نامعتبر"),
});

// ── Platforms ───────────────────────────────────────────────────────────────

export const platformConnectSchema = z.object({
  token: z.string().min(10, "توکن معتبر نیست").max(500),
  targetId: z.string().max(200).optional(),
  name: z.string().max(100).optional(),
});

// ── Helper: safe parse ──────────────────────────────────────────────────────

export function validateBody<T>(schema: z.ZodSchema<T>, body: unknown): 
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message ?? "ورودی نامعتبر" };
}
