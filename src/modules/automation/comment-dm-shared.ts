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
    // Presentation Forms (Arabic/Persian contextual forms) → base letters
    .replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g, (ch) => {
      // Map common presentation forms to their base letters
      const map: Record<string, string> = {
        '\uFB91': 'ی', '\uFB92': 'ک', '\uFB93': 'ک', '\uFB94': 'ک', '\uFB95': 'ک',
        '\uFE81': 'ا', '\uFE82': 'ا', '\uFE83': 'ا', '\uFE84': 'ا',
        '\uFE85': 'و', '\uFE86': 'و', '\uFE87': 'ا', '\uFE88': 'ا',
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
    .toLowerCase()
    .replace(/ي/g, 'ی')          // Arabic yeh → Persian yeh
    .replace(/ك/g, 'ک')          // Arabic kaf → Persian kaf
    .replace(/ة/g, 'ه')          // teh marbuta → heh
    .replace(/[أإآؤئ]/g, (ch) => ch === 'ؤ' || ch === 'ئ' ? 'ی' : 'ا')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) // Persian → ASCII digits
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))  // Arabic-Indic → ASCII digits
    .replace(/[\u064B-\u065F\u0670]/g, '') // harakat / diacritics
    .replace(/\u200C/g, ' ')     // ZWNJ (half-space) → space
    .replace(/\u200E|\u200F/g, '') // RLM/LRM marks → remove
    .replace(/[.,،؛:!؟?()«»"'\-_/\\]+/g, ' ') // punctuation → space
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a comma/newline separated keyword field into a clean list.
 * Supports multi-word phrases: "قیمت چنده" is one keyword, not two.
 * Separators: comma (,), Persian comma (،), newline, and pipe (|).
 */
export function parseKeywordList(raw: string): string[] {
  return raw
    .split(/[,،\n|]+/)
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
