/**
 * AI types and constants — NO SDK imports.
 * Safe to import from client components.
 */

export type Platform = 'instagram' | 'telegram' | 'linkedin' | 'rubika' | 'bale' | 'eitaa'
export type Tone =
  'friendly' | 'formal' | 'professional' | 'storytelling' | 'sales' | 'educational' | 'poetic'
export type CreatorRole =
  'influencer' | 'store' | 'reviewer' | 'educator' | 'brand' | 'news' | 'community'
export type ContentGoal = 'sell' | 'educate' | 'review' | 'announce' | 'engage' | 'inspire'
export type CaptionLength = 'short' | 'standard' | 'long'

export interface HashtagSuggestion {
  tag: string
  reason: string
}

export const CREATOR_ROLES: { id: CreatorRole; label: string; emoji: string }[] = [
  { id: 'influencer', label: 'اینفلوئنسر', emoji: '✨' },
  { id: 'store', label: 'فروشگاه', emoji: '🛍️' },
  { id: 'reviewer', label: 'بلاگر', emoji: '📝' },
  { id: 'educator', label: 'آموزشگر', emoji: '🎓' },
  { id: 'brand', label: 'برند', emoji: '🏢' },
  { id: 'news', label: 'رسانه', emoji: '📰' },
  { id: 'community', label: 'انجمن', emoji: '💬' },
]

export const CONTENT_GOALS: { id: ContentGoal; label: string; emoji: string }[] = [
  { id: 'engage', label: 'تعامل', emoji: '💭' },
  { id: 'sell', label: 'فروش', emoji: '💰' },
  { id: 'educate', label: 'آموزش', emoji: '📚' },
  { id: 'review', label: 'نقد و بررسی', emoji: '🔍' },
  { id: 'announce', label: 'اعلام', emoji: '📢' },
  { id: 'inspire', label: 'انگیزه', emoji: '🌟' },
]

export const CAPTION_LENGTHS: { id: CaptionLength; label: string; emoji: string }[] = [
  { id: 'short', label: 'خلاصه', emoji: '✂️' },
  { id: 'standard', label: 'استاندارد', emoji: '⚖️' },
  { id: 'long', label: 'مفصل', emoji: '📖' },
]

// Tone labels — used in the UI
export const TONE_LABELS: { id: Tone; label: string; emoji: string; sample: string }[] = [
  { id: 'friendly', label: 'صمیمی', emoji: '😊', sample: 'امروز یه چیز جالب پیدا کردم…' },
  { id: 'formal', label: 'رسمی', emoji: '🎩', sample: 'به این امر توجه فرمایید…' },
  { id: 'professional', label: 'حرفه‌ای', emoji: '💼', sample: 'بررسی تخصصی موضوع…' },
  { id: 'storytelling', label: 'داستانی', emoji: '📖', sample: 'یادم میاد یه روز…' },
  { id: 'sales', label: 'فروش', emoji: '🛒', sample: 'فقط تا امشب فرصت داری…' },
  { id: 'educational', label: 'آموزشی', emoji: '💡', sample: 'آیا می‌دونستی که…' },
  { id: 'poetic', label: 'ادبی', emoji: '🌙', sample: 'چون هنگام شب…' },
]
