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

// ── API Tokens (#255) ───────────────────────────────────────────────────────
//
// Scopes are validated against the same enum used in src/lib/auth-guards.ts
// (API_SCOPES). Keep both lists in sync — the auth guard enforces them at
// request time, the Zod schema enforces them at creation time. expiresAt is
// an ISO-8601 datetime string (or null for "no expiry").

export const apiTokenCreateSchema = z.object({
  name: persianText(1, 100, 'نام توکن الزامی است'),
  scopes: z
    .array(
      z.enum([
        'content:read',
        'content:write',
        'publications:read',
        'inbox:read',
        'reports:read',
      ])
    )
    .min(1, 'حداقل یک دسترسی الزامی است'),
  expiresAt: z.string().datetime().nullable().optional(),
})

// ── Webhooks (#255) ─────────────────────────────────────────────────────────
//
// URLs MUST be HTTPS — no plaintext http:// allowed, because the webhook
// secret travels in the request body. Events are free-form strings so we can
// add new event types (publish.success, inbox.new, …) without a migration;
// the route layer should reject unknown event names with a 400.

export const webhookCreateSchema = z.object({
  url: z
    .string()
    .url('آدرس وب‌هوک نامعتبر است')
    .max(500)
    .regex(/^https:\/\//, 'آدرس باید HTTPS باشد'),
  events: z
    .array(z.string().min(1).max(50))
    .min(1, 'حداقل یک رویداد الزامی است')
    .max(20),
})

export const webhookUpdateSchema = webhookCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// ── Automations (#249) ──────────────────────────────────────────────────────
//
// An automation definition is a JSON blob with three arrays: triggers,
// conditions, actions. Each piece is `{ type, config }` where config is a
// free-form record (per-type validation happens in the service layer).
//
// The schema enforces structural shape only (so we can add new trigger/
// condition/action types without a Zod migration); the service's
// `validateDefinition` enforces presence of at least one trigger + one action.

const automationTriggerSchema = z.object({
  type: z.enum([
    'schedule',
    'keyword',
    'status_change',
    'provider_event',
    'date_holiday',
  ]),
  config: z.record(z.string(), z.unknown()),
})

const automationConditionSchema = z.object({
  type: z.enum([
    'channel',
    'tag',
    'campaign',
    'time_window',
    'approval_state',
  ]),
  config: z.record(z.string(), z.unknown()),
})

const automationActionSchema = z.object({
  type: z.enum([
    'create_draft',
    'add_to_queue',
    'send_notification',
    'assign_inbox',
    'add_reply',
    'add_tag',
    'call_webhook',
  ]),
  config: z.record(z.string(), z.unknown()),
})

const automationDefinitionSchema = z.object({
  triggers: z.array(automationTriggerSchema).max(20, 'حداکثر ۲۰ راه‌انداز مجاز است'),
  conditions: z.array(automationConditionSchema).max(50, 'حداکثر ۵۰ شرط مجاز است'),
  actions: z.array(automationActionSchema).max(50, 'حداکثر ۵۰ اقدام مجاز است'),
})

export const automationCreateSchema = z.object({
  name: persianText(1, 100, 'نام اتوماسیون الزامی است'),
  description: persianText(0, 500).optional(),
  definition: automationDefinitionSchema,
  dryRunMode: z.boolean().optional().default(false),
  maxRunsPerHour: z.coerce
    .number()
    .int('حداکثر اجرا در ساعت باید عدد صحیح باشد')
    .min(1, 'حداقل ۱ اجرا در ساعت مجاز است')
    .max(1000, 'حداکثر ۱۰۰۰ اجرا در ساعت مجاز است')
    .optional()
    .default(10),
  requireApproval: z.boolean().optional().default(false),
})

export const automationUpdateSchema = automationCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
  killSwitch: z.boolean().optional(),
})

// ── Agency (#254) ────────────────────────────────────────────────────────────
//
// Agency multi-client overview: white-label profile, workspace templates,
// client portal access tokens. The portal token route is PUBLIC (validated by
// the access token itself, no session) — see src/app/api/agency/portal/[token].
//
// Permissions are an explicit enum so a stray string like "admin:all" can't
// sneak through the body parser. The service re-validates against the same set
// at runtime (defense in depth).

export const AGENCY_PORTAL_PERMISSIONS = [
  'content:view',
  'content:approve',
  'content:comment',
] as const

export const agencyProfileSchema = z.object({
  brandName: z.string().trim().max(100, 'نام برند خیلی طولانی است').nullable().optional(),
  brandLogoUrl: z
    .string()
    .trim()
    .max(500, 'آدرس لوگوی برند خیلی طولانی است')
    .url('آدرس لوگوی برند نامعتبر است')
    .nullable()
    .optional(),
  hideNashrinoBranding: z.boolean().optional(),
  clientWorkspaceIds: z.array(z.string().min(1).max(100)).max(500).optional(),
})

export const templateCreateSchema = z.object({
  name: persianText(1, 100, 'نام قالب الزامی است'),
  description: persianText(0, 500).optional(),
  template: z
    .record(z.string(), z.unknown())
    .refine((v) => v && typeof v === 'object', 'پیکربندی قالب نامعتبر است'),
})

export const templateUpdateSchema = templateCreateSchema.partial()

export const portalAccessCreateSchema = z.object({
  workspaceId: z.string().min(1, 'شناسه فضای کار الزامی است').max(100),
  permissions: z
    .array(z.enum(AGENCY_PORTAL_PERMISSIONS))
    .min(1, 'حداقل یک دسترسی الزامی است'),
  expiresAt: z.string().datetime().nullable().optional(),
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

// ── Listening (#251) ────────────────────────────────────────────────────────
//
// Social listening saved searches. Each query tracks keywords across one or
// more providers (instagram, telegram), with a spike-alert config (rolling
// mean + stddev threshold) and honest coverage-notes disclosure.
//
// Languages are optional ('fa', 'en', 'ar' or empty for all). Providers MUST
// be a non-empty array — the service layer rejects zero-provider queries with
// a Persian ValidationError. coverageNotes is free-form Persian text so the
// workspace admin can describe what is NOT accessible via the provider API.

export const listeningQueryCreateSchema = z.object({
  name: persianText(1, 100, 'نام جستجو الزامی است'),
  keywords: z
    .array(persianText(1, 200, 'کلمه کلیدی نامعتبر است'))
    .min(1, 'حداقل یک کلمه کلیدی الزامی است')
    .max(50, 'حداکثر ۵۰ کلمه کلیدی مجاز است'),
  languages: z
    .array(z.enum(['fa', 'en', 'ar']))
    .max(10)
    .optional()
    .default([]),
  providers: z
    .array(z.string().min(1).max(50))
    .min(1, 'حداقل یک پلتفرم الزامی است')
    .max(10),
  spikeAlertEnabled: z.boolean().optional().default(true),
  spikeThreshold: z.coerce
    .number()
    .min(0.5, 'حداکثر آستانه حداقل ۰.۵ باشد')
    .max(10, 'حداکثر آستانه نباید بیشتر از ۱۰ باشد')
    .optional()
    .default(3.0),
  coverageNotes: persianText(0, 1000).optional(),
})

export const listeningQueryUpdateSchema = listeningQueryCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
})

// Mentions list query: cursor + filter (spike / sentiment / language).
export const listeningMentionsQuerySchema = cursorPaginationSchema.extend({
  spike: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  sentiment: z.enum(['positive', 'neutral', 'negative']).optional(),
  language: z.string().min(2).max(10).optional(),
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

// ── Customers + Cases (#248) ─────────────────────────────────────────────────
//
// Customer profiles unify a contact across platforms. socialHandles is a
// free-form JSON record (e.g. { instagram: '@user', telegram: 'user' }).
// consentStatus is an enum: unknown | granted | denied. Cases bundle related
// customer interactions and link to inbox messages via linkedMessageIds.

export const customerCreateSchema = z.object({
  name: persianText(1, 200, 'نام مشتری الزامی است'),
  email: z.string().email('ایمیل معتبر نیست').max(200).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  socialHandles: z.record(z.string(), z.string()).optional(),
  avatarUrl: z.string().url().max(500).nullable().optional(),
  tags: z.array(persianText(1, 50)).max(30).optional().default([]),
  notes: z.string().max(5000).nullable().optional(),
  consentStatus: z.enum(['unknown', 'granted', 'denied']).optional().default('unknown'),
})

export const customerUpdateSchema = customerCreateSchema.partial().extend({
  optOutAt: z.string().datetime().nullable().optional(),
})

export const customerInteractionCreateSchema = z.object({
  type: z.enum(['comment', 'dm', 'mention', 'reply']),
  platform: z.string().min(1).max(50),
  content: z.string().trim().min(1, 'محتوای تعامل الزامی است').max(5000),
  direction: z.enum(['inbound', 'outbound']).optional().default('inbound'),
  inboxMessageId: z.string().max(100).nullable().optional(),
  handledBy: z.string().max(100).nullable().optional(),
})

export const customerMergeSchema = z.object({
  targetId: z.string().min(1, 'شناسه مشتری هدف الزامی است').max(100),
})

export const caseCreateSchema = z.object({
  title: persianText(1, 200, 'عنوان پرونده الزامی است'),
  description: persianText(0, 2000).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional().default('normal'),
  assigneeId: z.string().max(100).nullable().optional(),
  linkedMessageIds: z.array(z.string().max(100)).max(100).optional().default([]),
})

export const caseUpdateSchema = caseCreateSchema.partial().extend({
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  resolution: z.string().max(5000).nullable().optional(),
})

export const caseParticipantSchema = z.object({
  customerId: z.string().min(1, 'شناسه مشتری الزامی است').max(100),
  role: z.enum(['primary', 'cc', 'mentioned']).optional().default('primary'),
})

// ── AI Evaluation (#252) ─────────────────────────────────────────────────────
//
// An evaluation set bundles Persian prompts sharing a tone. Used by the
// developer harness to regression-test caption quality before shipping
// prompt changes. Scores are 1–5; feedback is free-form Persian text.

export const evaluationSetCreateSchema = z.object({
  name: persianText(1, 100, 'نام مجموعه الزامی است'),
  tone: z.enum(['formal', 'friendly', 'promotional', 'support', 'professional']),
  prompts: z
    .array(
      z.object({
        prompt: persianText(1, 500, 'متن پرامپت الزامی است'),
        platform: z.enum(['instagram', 'telegram']),
        tone: z.enum(['formal', 'friendly', 'promotional', 'support', 'professional']),
      })
    )
    .min(1, 'حداقل یک پرامپت الزامی است')
    .max(50, 'حداکثر ۵۰ پرامپت مجاز است'),
})

export const evaluationRunSchema = z.object({
  indices: z.array(z.number().int().min(0).max(49)).max(50).optional(),
})

export const evaluationFeedbackSchema = z.object({
  score: z.number().int().min(1, 'حداقل امتیاز ۱ است').max(5, 'حداکثر امتیاز ۵ است'),
  feedback: persianText(0, 2000).optional(),
})

// ── Competitors (#253) ───────────────────────────────────────────────────────
//
// Competitor profiles track a rival brand's handle on one platform. The
// benchmark + share-of-voice endpoints return aggregated stats per
// competitor (computed by the service from existing analytics snapshots).

export const competitorCreateSchema = z.object({
  name: persianText(1, 100, 'نام رقیب الزامی است'),
  handle: z.string().trim().min(1, 'شناسه رقیب الزامی است').max(100),
  platform: z.string().min(1).max(50),
  trackedMetrics: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
})

export const competitorUpdateSchema = competitorCreateSchema.partial()

// ── Enterprise SSO + Custom Roles (#256) ─────────────────────────────────────
//
// SSO configs store provider metadata (SAML entity ID / OIDC metadata URL).
// Custom roles are named permission bundles — `permissions` is a string
// array so we can add new permission keys without a migration.

export const ssoConfigCreateSchema = z.object({
  provider: z.enum(['saml', 'oidc'], 'نوع ارائه‌دهنده نامعتبر است'),
  entityId: z.string().trim().max(500).nullable().optional(),
  certificate: z.string().trim().max(10000).nullable().optional(),
  metadataUrl: z.string().url('آدرس متادیتا نامعتبر است').max(500).nullable().optional(),
  isActive: z.boolean().optional().default(false),
})

export const ssoConfigUpdateSchema = ssoConfigCreateSchema.partial()

export const customRoleCreateSchema = z.object({
  name: persianText(1, 100, 'نام نقش الزامی است'),
  permissions: z
    .array(z.string().min(1).max(100))
    .min(1, 'حداقل یک دسترسی الزامی است')
    .max(50),
  description: persianText(0, 500).optional(),
})

export const customRoleUpdateSchema = customRoleCreateSchema.partial()

export const auditExportSchema = z.object({
  format: z.enum(['json', 'csv']).optional().default('json'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  action: z.string().max(100).optional(),
  userId: z.string().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional().default(1000),
})

// ── Settings: workspace profile + brand kit (#213 / settings-brandkit) ───────
//
// PATCH /api/workspace accepts any subset of these fields. Profile fields
// (name/description/phone/timezone/workWeek/persianDigits) are validated
// strictly. Brand-kit fields (colors, voice, CTA, hashtags, footer, banned
// words, content guidelines) are free-form strings with sensible caps — they
// are advisory copy that the AI caption prompt consumes verbatim.

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

export const workspaceUpdateSchema = z
  .object({
    // Profile fields
    name: persianText(1, 200, 'نام فضای کار الزامی است').optional(),
    description: z.string().trim().max(2000, 'توضیحات خیلی طولانی است').optional(),
    phone: z
      .string()
      .trim()
      .max(50, 'شماره تلفن نامعتبر است')
      .optional(),
    timezone: z
      .string()
      .trim()
      .min(1, 'منطقه زمانی الزامی است')
      .max(100)
      .optional(),
    workWeek: z
      .string()
      .trim()
      .max(50)
      .optional(),
    persianDigits: z.boolean().optional(),
    category: z.string().trim().max(100).optional(),

    // Brand-kit fields
    brandPrimaryColor: z
      .string()
      .trim()
      .regex(HEX_COLOR_RE, 'رنگ باید با # شروع و ۶ رقم هگز باشد')
      .optional(),
    brandAccentColor: z
      .string()
      .trim()
      .regex(HEX_COLOR_RE, 'رنگ باید با # شروع و ۶ رقم هکس باشد')
      .optional(),
    brandVoice: z.string().trim().max(500).optional(),
    defaultCta: z.string().trim().max(300).optional(),
    contentGuidelines: z.string().trim().max(5000).optional(),
    defaultHashtags: z.string().trim().max(500).optional(),
    captionFooter: z.string().trim().max(500).optional(),
    // Issue #213: comma-separated Persian phrases. Empty string = no ban list.
    bannedWords: z.string().trim().max(2000).optional(),
  })
  .strict()

// ── Notification preferences (#213 / settings-brandkit) ──────────────────────
//
// Stored as a JSON record on User.notificationPreferences, keyed by category
// id. Each value is a 3-channel on/off record. The PATCH route merges into the
// existing record so the client can update one channel at a time.

export const NOTIFICATION_CATEGORY_IDS = [
  'publish_success',
  'publish_failed',
  'approval_requested',
  'inbox_new',
  'token_expiring',
  'channel_disconnected',
] as const

export type NotificationCategoryId = (typeof NOTIFICATION_CATEGORY_IDS)[number]

export const notificationChannelSchema = z.object({
  email: z.boolean(),
  push: z.boolean(),
  inApp: z.boolean(),
})

export type NotificationChannel = z.infer<typeof notificationChannelSchema>

export const notificationPreferencesSchema = z
  .record(z.string(), notificationChannelSchema)
  .refine(
    (rec) =>
      Object.keys(rec).every((k) =>
        (NOTIFICATION_CATEGORY_IDS as readonly string[]).includes(k),
      ),
    { message: 'دسته اعلان ناشناخته است' },
  )

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
