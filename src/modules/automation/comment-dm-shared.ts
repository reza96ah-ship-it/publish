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
  keyword: string
  dmTemplate: string
  publicReply: string | null   // optional public comment reply
  optOutKeyword: string
  freqCapHours: number
  isActive: boolean
  createdAt: Date | string
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

  for (const re of patterns) {
    const m = caption.match(re)
    if (m) {
      // return the first capture group that looks like a keyword (not a verb)
      const verbs = new Set(['را', 'در', 'کنید', 'بنویسید', 'کامنت', 'تا', 'و'])
      const candidate = m[1] || m[2]
      if (candidate && !verbs.has(candidate)) return candidate
      if (m[2] && !verbs.has(m[2])) return m[2]
    }
  }
  return null
}
