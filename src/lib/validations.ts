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
  platformCaptions: z.record(z.string(), z.string()).optional(),
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

// ── Publish Jobs (reschedule) ───────────────────────────────────────────────

export const rescheduleSchema = z.object({
  action: z.literal("reschedule"),
  scheduledAt: z.string()
    .refine((s) => !isNaN(Date.parse(s)), "تاریخ معتبر نیست")
    .refine((s) => new Date(s).getTime() > Date.now() - 60_000, "تاریخ باید در آینده باشد"),
});

// ── Campaigns ───────────────────────────────────────────────────────────────

export const campaignCreateSchema = z.object({
  name: z.string({ error: "نام کمپین الزامی است" }).trim().min(1, "نام کمپین الزامی است").max(100, "نام کمپین نباید از ۱۰۰ کاراکتر بیشتر باشد"),
  description: z.string().max(500, "توضیحات خیلی طولانی است").optional(),
  color: z.string().max(20).optional(),
  platformTypes: z.array(platformTypeSchema).optional(),
});

// ── Query-string schemas (GET params) ───────────────────────────────────────

export const contentListQuerySchema = z.object({
  status: z.enum(["draft", "scheduled", "published", "review", "rejected"], { error: "وضعیت نامعتبر است" }).optional(),
  campaignId: z.string().max(100).optional(),
});

export const contentCommentsQuerySchema = z.object({
  parentId: z.string().max(100).optional(),
});

export const mediaUploadQuerySchema = z.object({
  fileName: z.string().max(200, "نام فایل خیلی طولانی است").optional(),
});

// ── Generic helpers ─────────────────────────────────────────────────────────

export const idSchema = z.string().min(1, "شناسه الزامی است").max(100);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

// Helper: validate a single [id] path param — returns Persian error on failure.
export function validateId(id: unknown): { success: true; data: string } | { success: false; error: string } {
  return validateBody(idSchema, id) as { success: true; data: string } | { success: false; error: string };
}

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

// Helper: validate search params (GET query strings)
export function validateParams<T>(schema: z.ZodSchema<T>, params: Record<string, string | string[] | undefined>):
  { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(params);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.issues[0];
  return { success: false, error: firstError?.message ?? "پارامتر نامعتبر" };
}
