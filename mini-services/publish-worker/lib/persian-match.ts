/**
 * Self-contained Persian text matching for the comment→DM scanner.
 *
 * The main app's `src/modules/automation/comment-dm-shared.ts` is the source
 * of truth; this is a focused copy of the pure functions the worker needs,
 * because the worker is an independent Bun package (it does not import from
 * `src/`). Keep these in sync with the shared module.
 *
 * Used by:
 *   - comment-dm-scanner.ts (match incoming IG comments against rule keywords)
 *   - opt-out keyword detection (normalizePersian on both sides)
 */

export type MatchReason = 'match' | 'excluded' | 'no_match'

export interface MatchResult {
  matched: boolean
  reason: MatchReason
  hit: string | null
}

/**
 * Normalize Persian/Arabic text for robust keyword matching:
 * unify letter variants (ي→ی, ك→ک, ة→ه), strip diacritics, collapse ZWNJ and
 * whitespace, convert Persian/Arabic digits to ASCII, drop most punctuation.
 * Emoji are preserved.
 */
export function normalizePersian(input: string): string {
  if (!input) return ''
  return input
    .replace(/[\uFB50-\uFDFF\uFE70-\uFEFF]/g, (ch) => {
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
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[أإآؤئ]/g, (ch) => (ch === 'ؤ' || ch === 'ئ' ? 'ی' : 'ا'))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\u200C/g, ' ')
    .replace(/\u200E|\u200F/g, '')
    .replace(/[.,،؛:!؟?()«»"'\-_/\\]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Split a comma/newline/pipe separated keyword field into a clean list.
 * Supports multi-word phrases: "قیمت محصول" stays as one keyword.
 */
export function parseKeywordList(raw: string): string[] {
  if (!raw) return []
  return raw
    .split(/[,،\n|]+/)
    .map((k) => k.trim())
    .filter(Boolean)
}

/**
 * Decide whether a comment should trigger a rule.
 * Exclude keywords win over trigger keywords. Matching is normalization-aware
 * substring matching, which suits Persian (no spaces between word parts and
 * affixes make word-boundary matching unreliable).
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

/** Interpolate {نام} variable in DM template. Falls back to «کاربر». */
export function renderDmTemplate(template: string, senderName: string, link = ''): string {
  return template
    .replace(/\{نام\}/g, senderName || 'کاربر')
    .replace(/\{لینک\}/g, link)
}
