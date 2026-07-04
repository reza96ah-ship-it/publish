/**
 * Client-safe comment-to-DM utilities (#209).
 * No server imports — bundled into the browser.
 * Server CRUD + policy checks live in ./comment-dm.ts.
 */

export interface CommentDmRule {
  id: string
  platformId: string
  platformName: string
  keyword: string
  dmTemplate: string
  optOutKeyword: string
  freqCapHours: number
  isActive: boolean
  createdAt: Date | string
}

/** Preview: interpolate {نام} variable in DM template. */
export function previewTemplate(template: string, senderName: string): string {
  return template.replace(/\{نام\}/g, senderName || 'کاربر')
}
