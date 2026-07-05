/**
 * Shared Zod validation schemas for all API routes.
 *
 * Usage:
 *   import { publishSchema } from "@/lib/validations";
 *   const parsed = publishSchema.safeParse(body);
 *   if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
 *   // use parsed.data (typed)
 */

import { z } from 'zod'

// ── Persian text normalization (P1-25) ──────────────────────────────────────

/**
 * Normalize Arabic letter variants to their Persian equivalents.
 * Applied as a Zod transform on user-input text fields so stored data is
 * consistent regardless of which keyboard the user typed with.
 *
 * This is a LIGHTER version of normalizePersian (in comment-dm-shared.ts):
 * it only converts Arabic letters (ي→ی, ك→ک, ة→ه, alef variants) and strips
 * diacritics. It does NOT convert Persian digits to ASCII (those should stay
 * Persian in display text) or collapse ZWNJ (important for Persian compound
 * words like ثبت‌نام).
 *
 * Without this, Arabic keyboards produce ي/ك which render with different
 * glyphs, break alphabetical sorting, and fail search matching against
 * Persian-typed queries.
 */
export function normalizeArabicToPersian(input: string): string {
  if (!input) return input
  return input
    .replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g, (ch) => {
      // Presentation Forms → base letters (same map as normalizePersian)
      const map: Record<string, string> = {
        '\uFB91': 'ی', '\uFB92': 'ک', '\uFB93': 'ک', '\uFB94': 'ک', '\uFB95': 'ک',
        '\uFE89': 'ی', '\uFE8A': 'ی', '\uFE8B': 'ی', '\uFE8C': 'ی',
        '\uFE8D': 'ا', '\uFE8E': 'ا', '\uFE8F': 'ب', '\uFE90': 'ب',
        '\uFE91': 'ب', '\uFE92': 'ب', '\uFE93': 'ه', '\uFE94': 'ه',
        '\uFE95': 'ج', '\uFE96': 'ج', '\uFE97': 'ج', '\uFE98': 'ج',
        '\uFE99': 'ح', '\uFE9A': 'ح', '\uFE9B': 'ح', '\uFE9C': 'ح',
        '\uFE9D': 'خ', '\uFE9E': 'خ', '\uFE9F': 'خ', '\uFEA0': 'خ',
        '\uFEA1': 'د', '\uFEA2': 'د', '\uFEA3': 'ذ', '\uFEA4': 'ذ',
        '\uFEA5': 'ر', '\uFEA6': 'ر', '\uFEA7': 'ز', '\uFEA8': 'ز',
        '\uFEA9': 'س', '\uFEAA': 'س', '\uFEAB': 'ش', '\uFEAC': 'ش',
        '\uFEAD': 'ص', '\uFEAE': 'ص', '\uFEAF': 'ض', '\uFEB0': 'ض',
        '\uFEB1': 'ط', '\uFEB2': 'ط', '\uFEB3': 'ط', '\uFEB4': 'ط',
        '\uFEB5': 'ظ', '\uFEB6': 'ظ', '\uFEB7': 'ظ', '\uFEB8': 'ظ',
        '\uFEB9': 'ع', '\uFEBA': 'ع', '\uFEBB': 'ع', '\uFEBC': 'ع',
        '\uFEBD': 'غ', '\uFEBE': 'غ', '\uFEBF': 'غ', '\uFEC0': 'غ',
        '\uFEC1': 'ف', '\uFEC2': 'ف', '\uFEC3': 'ف', '\uFEC4': 'ف',
        '\uFEC5': 'ق', '\uFEC6': 'ق', '\uFEC7': 'ق', '\uFEC8': 'ق',
        '\uFEC9': 'ک', '\uFECA': 'ک', '\uFECB': 'ک', '\uFECC': 'ک',
        '\uFECD': 'ل', '\uFECE': 'ل', '\uFECF': 'ل', '\uFED0': 'ل',
        '\uFED1': 'م', '\uFED2': 'م', '\uFED3': 'م', '\uFED4': 'م',
        '\uFED5': 'ن', '\uFED6': 'ن', '\uFED7': 'ن', '\uFED8': 'ن',
        '\uFED9': 'ه', '\uFEDA': 'ه', '\uFEDB': 'ه', '\uFEDC': 'ه',
        '\uFEDD': 'و', '\uFEDE': 'و', '\uFEDF': 'و', '\uFEE0': 'و',
        '\uFEE1': 'ی', '\uFEE2': 'ی', '\uFEE3': 'ی', '\uFEE4': 'ی',
        '\uFEE5': 'ی', '\uFEE6': 'ی', '\uFEE7': 'ی', '\uFEE8': 'ی',
        '\uFEE9': 'ا', '\uFEEA': 'ا', '\uFEEB': 'ا', '\uFEEC': 'ا',
        '\uFEED': 'و', '\uFEEE': 'و', '\uFEEF': 'ا', '\uFEF0': 'ا',
        '\uFEF1': 'ی', '\uFEF2': 'ی', '\uFEF3': 'ی', '\uFEF4': 'ی',
      }
      return map[ch] ?? ch
    })
    .replace(/ي/g, 'ی')          // Arabic yeh → Persian yeh
    .replace(/ك/g, 'ک')          // Arabic kaf → Persian kaf
    .replace(/ة/g, 'ه')          // teh marbuta → heh
    .replace(/[أإآؤئ]/g, (ch) => (ch === 'ؤ' || ch === 'ئ' ? 'ی' : 'ا'))
    .replace(/[\u064B-\u065F\u0670]/g, '') // harakat / diacritics
}

/**
 * Zod string factory for Persian text fields — trims, validates length,
 * and normalizes Arabic letter variants to Persian. Use for any user-input
 * text that gets stored (titles, names, templates, descriptions).
 */
export const persianText = (min = 1, max = 1000, msg = 'الزامی است') =>
  z
    .string({ error: msg })
    .trim()
    .min(min, msg)
    .max(max, 'متن خیلی طولانی است')
    .transform(normalizeArabicToPersian)

// ── Platform types ──────────────────────────────────────────────────────────

export const platformTypeSchema = z.enum([
  'instagram',
  'telegram',
  'linkedin',
  'rubika',
  'bale',
  'eitaa',
])

// ── Publish ─────────────────────────────────────────────────────────────────

export const publishSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'عنوان الزامی است')
    .max(200, 'عنوان نباید از ۲۰۰ کاراکتر بیشتر باشد'),
  caption: z.string().max(5000, 'کپشن خیلی طولانی است').optional().default(''),
  hashtags: z.string().max(500).optional(),
  note: z.string().max(1000).optional(),
  campaignId: z.string().optional(),
  campaignName: z.string().optional(),
  mediaIds: z.array(z.string()).optional().default([]),
  // BUG-08: use explicit channel UUIDs instead of platform type strings
  channelIds: z
    .array(z.string().uuid('شناسه کانال نامعتبر است'))
    .min(1, 'حداقل یک کانال لازم است')
    .optional(),
  platformCaptions: z.record(z.string(), z.string()).optional(),
  scheduleMode: z.enum(['now', 'schedule', 'queue']).optional().default('now'),
  // BUG-01: unified ISO timestamp instead of split Jalali date+time fields
  scheduledAt: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'تاریخ زمان‌بندی نامعتبر است')
    .optional()
    .nullable(),
  thumbnail: z.string().nullable().optional(),
  mode: z.enum(['publish', 'review', 'draft']).optional().default('publish'),
})

// ── AI ──────────────────────────────────────────────────────────────────────

export const aiCaptionSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(3, 'موضوع حداقل ۳ کاراکتر باید باشد')
    .max(1000, 'موضوع خیلی طولانی است'),
  platform: platformTypeSchema,
  tone: z
    .enum(['formal', 'friendly', 'professional', 'storytelling', 'sales', 'educational', 'poetic'])
    .optional(),
  role: z
    .enum(['influencer', 'store', 'reviewer', 'educator', 'brand', 'news', 'community'])
    .optional(),
  goal: z.enum(['sell', 'educate', 'review', 'announce', 'engage', 'inspire']).optional(),
  length: z.enum(['short', 'standard', 'long']).optional(),
  variation: z.number().int().min(0).optional().default(0),
  voiceExamples: z.string().max(3000).optional(),
})

export const aiHashtagsSchema = z.object({
  topic: z.string().trim().min(3, 'موضوع حداقل ۳ کاراکتر باید باشد').max(1000),
  platform: platformTypeSchema,
  existingHashtags: z.string().optional(),
  role: z
    .enum(['influencer', 'store', 'reviewer', 'educator', 'brand', 'news', 'community'])
    .optional(),
  goal: z.enum(['sell', 'educate', 'review', 'announce', 'engage', 'inspire']).optional(),
})

export const aiDraftSchema = z.object({
  title: z.string().max(200).optional(),
  body: z.string().min(1, 'متن کپشن خالی است').max(5000),
  hashtags: z.string().optional(),
  platform: z.string().optional(),
  tone: z.string().optional(),
  role: z.string().optional(),
  goal: z.string().optional(),
  length: z.string().optional(),
})

// ── Inbox ───────────────────────────────────────────────────────────────────

export const inboxReplySchema = z.object({
  reply: z.string().trim().min(1, 'متن پاسخ خالی است').max(2000, 'پاسخ خیلی طولانی است'),
})

export const inboxAssignSchema = z.object({
  assigneeId: z.string().nullable(),
})

// ── Content ─────────────────────────────────────────────────────────────────

export const contentRejectSchema = z.object({
  reason: z.string().trim().min(1, 'دلیل رد را بنویسید').max(500, 'دلیل خیلی طولانی است'),
})

export const contentCommentSchema = z.object({
  text: z.string().trim().min(1, 'کامنت خالی است').max(1000, 'کامنت خیلی طولانی است'),
  parentId: z.string().optional(),
})

// ── Members ─────────────────────────────────────────────────────────────────

export const memberInviteSchema = z.object({
  email: z.string().email('ایمیل معتبر وارد کنید'),
  name: z.string().max(100).optional(),
  role: z.enum(['admin', 'editor', 'approver', 'viewer'], 'نقش نامعتبر'),
})

// ── Platforms ───────────────────────────────────────────────────────────────

export const platformConnectSchema = z.object({
  token: z.string().min(10, 'توکن معتبر نیست').max(500),
  targetId: z.string().max(200).optional(),
  name: z.string().max(100).optional(),
})

// ── Publish Jobs (reschedule) ───────────────────────────────────────────────

export const rescheduleSchema = z.object({
  action: z.literal('reschedule'),
  scheduledAt: z
    .string()
    .refine((s) => !isNaN(Date.parse(s)), 'تاریخ معتبر نیست')
    .refine((s) => new Date(s).getTime() > Date.now() - 60_000, 'تاریخ باید در آینده باشد'),
})

// ── Campaigns ───────────────────────────────────────────────────────────────

export const campaignCreateSchema = z.object({
  name: persianText(1, 100, 'نام کمپین الزامی است'),
  description: persianText(0, 500).optional(),
  color: z.string().max(20).optional(),
  platformTypes: z.array(platformTypeSchema).optional(),
})

// ── Comment DM Rules (P1-2) ─────────────────────────────────────────────────

export const commentDmRuleCreateSchema = z.object({
  platformId: z.string().min(1, 'شناسه پلتفرم الزامی است').max(100),
  keywords: z.array(persianText(1, 200)).min(1, 'حداقل یک کلمه کلیدی الزامی است').max(20),
  excludeKeywords: z.array(persianText(1, 200)).max(20).optional().default([]),
  dmTemplate: persianText(1, 2000, 'پیام دایرکت الزامی است'),
  buttonText: z.string().trim().max(100).nullable().optional(),
  buttonUrl: z.string().url('لینک دکمه نامعتبر است').max(500).nullable().optional(),
  publicReply: persianText(0, 500).nullable().optional(),
  optOutKeyword: persianText(1, 50).optional().default('نه'),
  freqCapHours: z.number().int().min(0, 'فاصله زمانی نمی‌تواند منفی باشد').max(168, 'حداکثر ۱۶۸ ساعت').optional().default(24),
  publicationId: z.string().max(100).nullable().optional(),
})

export const commentDmRuleUpdateSchema = z.object({
  platformId: z.string().min(1).max(100).optional(),
  keywords: z.array(z.string().trim().min(1).max(200)).min(1).max(20).optional(),
  excludeKeywords: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  dmTemplate: z.string().trim().min(1).max(2000).optional(),
  buttonText: z.string().trim().max(100).nullable().optional(),
  buttonUrl: z.string().url().max(500).nullable().optional(),
  publicReply: z.string().trim().max(500).nullable().optional(),
  optOutKeyword: z.string().trim().max(50).optional(),
  freqCapHours: z.number().int().min(0).max(168).optional(),
  isActive: z.boolean().optional(),
})

// ── UTM Presets (P1-2) ──────────────────────────────────────────────────────

export const utmPresetCreateSchema = z.object({
  name: persianText(1, 100, 'نام الزامی است'),
  source: z.string().trim().max(200).optional().default(''),
  medium: z.string().trim().max(200).optional().default(''),
  campaign: z.string().trim().max(200).optional().default(''),
  term: z.string().trim().max(200).optional().default(''),
  content: z.string().trim().max(200).optional().default(''),
  isDefault: z.boolean().optional(),
})

export const utmPresetUpdateSchema = utmPresetCreateSchema.partial()

// ── Saved Replies (P1-2) ────────────────────────────────────────────────────

export const savedReplyCreateSchema = z.object({
  title: persianText(1, 100, 'عنوان الزامی است'),
  body: persianText(1, 2000, 'متن پاسخ الزامی است'),
  tags: z.array(persianText(1, 50)).max(10).optional(),
})

export const savedReplyUpdateSchema = savedReplyCreateSchema.partial()

// ── Compose Draft (P1-2) ────────────────────────────────────────────────────

export const composeDraftSchema = z.object({
  content: z.record(z.string(), z.unknown()).refine((v) => v !== null && typeof v === 'object', {
    message: 'فیلد content الزامی است',
  }),
  channelIds: z.array(z.string().max(100)).max(20).optional().default([]),
  scheduledAt: z.string().datetime().nullable().optional(),
  version: z.number().int().min(0).optional(),
})

// ── Query-string schemas (GET params) ───────────────────────────────────────

export const contentListQuerySchema = z.object({
  status: z
    .enum(['draft', 'scheduled', 'published', 'review', 'rejected'], { error: 'وضعیت نامعتبر است' })
    .optional(),
  campaignId: z.string().max(100).optional(),
})

export const contentCommentsQuerySchema = z.object({
  parentId: z.string().max(100).optional(),
})

export const mediaUploadQuerySchema = z.object({
  fileName: z.string().max(200, 'نام فایل خیلی طولانی است').optional(),
})

// ── Smart Pages (#250) ──────────────────────────────────────────────────────

export const smartPageBlockSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('link'),
    id: z.string().max(100),
    label: persianText(1, 200, 'برچسب لینک الزامی است'),
    url: z.string().url('لینک نامعتبر است').max(500),
    icon: z.string().max(50).optional(),
  }),
  z.object({
    type: z.literal('social'),
    id: z.string().max(100),
    platform: z.string().max(50),
    url: z.string().url().max(500),
    label: z.string().max(100).optional(),
  }),
  z.object({
    type: z.literal('heading'),
    id: z.string().max(100),
    text: persianText(1, 200, 'متن عنوان الزامی است'),
  }),
  z.object({
    type: z.literal('text'),
    id: z.string().max(100),
    text: persianText(1, 1000, 'متن الزامی است'),
  }),
  z.object({
    type: z.literal('image'),
    id: z.string().max(100),
    url: z.string().url().max(500),
    alt: persianText(1, 200, 'متن جایگزین الزامی است'),
    caption: persianText(0, 200).optional(),
  }),
  z.object({
    type: z.literal('latest-posts'),
    id: z.string().max(100),
    limit: z.number().int().min(1).max(20),
    label: persianText(0, 100).optional(),
  }),
])

export const smartPageCreateSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'نامک الزامی است')
    .max(100, 'نامک خیلی طولانی است')
    .regex(
      /^[a-z0-9-]+$/,
      'نامک فقط می‌تواند شامل حروف انگلیسی کوچک، عدد و خط تیره باشد'
    ),
  title: persianText(1, 200, 'عنوان الزامی است'),
  description: persianText(0, 500).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  blocks: z
    .array(smartPageBlockSchema)
    .max(50, 'حداکثر ۵۰ بلوک مجاز است')
    .optional()
    .default([]),
  isPublished: z.boolean().optional().default(false),
})

export const smartPageUpdateSchema = smartPageCreateSchema.partial()

export const smartPageClickSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, 'نامک الزامی است')
    .max(100, 'نامک خیلی طولانی است')
    .regex(/^[a-z0-9-]+$/, 'نامک نامعتبر است'),
  blockId: z.string().min(1).max(100),
  blockType: z.string().min(1).max(50),
  label: z.string().max(200).optional().default(''),
  url: z.string().max(500).optional().default(''),
  referrer: z.string().max(500).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
})

// ── Generic helpers ─────────────────────────────────────────────────────────

export const idSchema = z.string().min(1, 'شناسه الزامی است').max(100)

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Cursor-based pagination (more efficient than offset for large tables)
export const cursorPaginationSchema = z.object({
  cursor: z.string().optional(), // last item ID from previous page
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
})

// Helper: validate a single [id] path param — returns Persian error on failure.
export function validateId(
  id: unknown
): { success: true; data: string } | { success: false; error: string } {
  return validateBody(idSchema, id) as
    { success: true; data: string } | { success: false; error: string }
}

// ── Helper: safe parse ──────────────────────────────────────────────────────

export function validateBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(body)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return { success: false, error: firstError?.message ?? 'ورودی نامعتبر' }
}

// Helper: validate search params (GET query strings)
export function validateParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, string | string[] | undefined>
): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(params)
  if (result.success) {
    return { success: true, data: result.data }
  }
  const firstError = result.error.issues[0]
  return { success: false, error: firstError?.message ?? 'پارامتر نامعتبر' }
}
