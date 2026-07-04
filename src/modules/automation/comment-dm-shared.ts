/**
 * Client-safe comment-to-DM utilities (#209).
 * No server imports — bundled into the browser.
 * Server CRUD + policy checks live in ./comment-dm.ts.
 */

export interface CommentDmRule {
  id: string
  platformId: string
  platformName: string
  publicationId: string | null // null = workspace-wide
  igPostId: string | null      // set after post publishes successfully
  keyword: string              // primary keyword (back-compat); mirrors keywords[0]
  keywords?: string[]          // trigger keywords (any match fires the rule)
  excludeKeywords?: string[]  // negative keywords that suppress the DM
  dmTemplate: string
  buttonText: string | null    // optional quick-reply button label
  buttonUrl: string | null     // optional quick-reply button URL
  publicReply: string | null   // optional public comment reply
  optOutKeyword: string
  freqCapHours: number
  status: string               // draft | active | paused | needs_attention
  isActive: boolean
  createdAt: Date | string
}

/**
 * Normalize Persian text for robust keyword matching:
 * unify Arabic/Persian letter variants, strip diacritics, collapse ZWNJ and
 * whitespace, drop most punctuation. Emoji and digits are preserved.
 */
export function normalizePersian(input: string): string {
  if (!input) return ''
  return input
    .toLowerCase()
    .replace(/ي/g, 'ی')          // Arabic yeh → Persian yeh
    .replace(/ك/g, 'ک')          // Arabic kaf → Persian kaf
    .replace(/ة/g, 'ه')          // teh marbuta → heh
    .replace(/[أإآ]/g, 'ا')       // alef variants → alef
    .replace(/[ؤئ]/g, 'ی')        // hamza-carriers → yeh (approx.)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) // Persian → ASCII digits
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))  // Arabic-Indic → ASCII digits
    .replace(/[ً-ٰٟ]/g, '') // harakat / diacritics
    .replace(/‌/g, ' ')     // ZWNJ (half-space) → space
    .replace(/[.,،؛:!؟?()«»"'\-_/\\]+/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
}

/** Split a comma/newline separated keyword field into a clean list. */
export function parseKeywordList(raw: string): string[] {
  return raw
    .split(/[,،\n]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

export type MatchReason = 'match' | 'excluded' | 'no_match'

export interface MatchResult {
  matched: boolean
  reason: MatchReason
  hit: string | null // which keyword matched (or the exclude term that blocked)
}

/**
 * Decide whether a comment should trigger a rule.
 * Exclude keywords win over trigger keywords. Matching is normalization-aware
 * and word-ish (substring on normalized text), which suits Persian well.
 */
export function matchComment(
  comment: string,
  keywords: string[],
  excludeKeywords: string[] = []
): MatchResult {
  const text = normalizePersian(comment)
  if (!text) return { matched: false, reason: 'no_match', hit: null }

  for (const ex of excludeKeywords) {
    const n = normalizePersian(ex)
    if (n && text.includes(n)) return { matched: false, reason: 'excluded', hit: ex }
  }

  for (const kw of keywords) {
    const n = normalizePersian(kw)
    if (n && text.includes(n)) return { matched: true, reason: 'match', hit: kw }
  }

  return { matched: false, reason: 'no_match', hit: null }
}

/** Preview: interpolate {نام} variable in DM template. */
export function previewTemplate(template: string, senderName: string): string {
  return template.replace(/\{نام\}/g, senderName || 'کاربر')
}

/**
 * Detect common Persian trigger phrases in a caption that suggest a
 * comment→DM rule should be set up. Returns the detected keyword or null.
 *
 * Matches patterns like:
 *   کلمه «قهوه» را کامنت کنید
 *   عدد ۵ را کامنت کنید
 *   برای دریافت … کلمه X را بنویسید
 *   X را در کامنت بنویسید
 */
export function detectCommentKeyword(caption: string): string | null {
  if (!caption) return null

  const patterns = [
    /کلمه\s+[«""]?(\S+?)[»""]?\s+را\s+(کامنت|بنویسید)/,
    /عدد\s+([۰-۹0-9]+)\s+را\s+(کامنت|بنویسید)/,
    /([۰-۹0-9]+)\s+را\s+(در\s+)?کامنت/,
    /کامنت\s+(کنید|بنویسید)[^،.]*کلمه\s+[«""]?(\S+?)[»""]/,
    /(\S+)\s+را\s+کامنت\s+کنید/,
    /(\S+)\s+بنویسید\s+تا/,
  ]

  const verbs = new Set(['را', 'در', 'کنید', 'بنویسید', 'کامنت', 'تا', 'و'])
  for (const re of patterns) {
    const m = caption.match(re)
    if (m) {
      const candidate = m[1] || m[2]
      if (candidate && !verbs.has(candidate)) return candidate
      if (m[2] && !verbs.has(m[2])) return m[2]
    }
  }
  return null
}
