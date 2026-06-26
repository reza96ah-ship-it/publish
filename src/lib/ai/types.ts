/**
 * AI types and constants — NO SDK imports.
 * Safe to import from client components.
 */

export type Platform = "instagram" | "telegram" | "linkedin" | "rubika" | "bale" | "eitaa";
export type Tone = "friendly" | "formal" | "professional" | "storytelling" | "sales" | "educational" | "poetic";
export type CreatorRole = "influencer" | "store" | "reviewer" | "educator" | "brand" | "news" | "community";
export type ContentGoal = "sell" | "educate" | "review" | "announce" | "engage" | "inspire";
export type CaptionLength = "short" | "standard" | "long";

export interface HashtagSuggestion {
  tag: string;
  reason: string;
}

export const CREATOR_ROLES: { id: CreatorRole; label: string; emoji: string }[] = [
  { id: "influencer", label: "اینفلوئنسر", emoji: "✨" },
  { id: "store", label: "فروشگاه", emoji: "🛍️" },
  { id: "reviewer", label: "نقدکننده", emoji: "📝" },
  { id: "educator", label: "آموزشگر", emoji: "🎓" },
  { id: "brand", label: "برند", emoji: "🏢" },
  { id: "news", label: "خبری", emoji: "📰" },
  { id: "community", label: "تسهیل‌گر بحث", emoji: "💬" },
];

export const CONTENT_GOALS: { id: ContentGoal; label: string; emoji: string }[] = [
  { id: "engage", label: "تعامل", emoji: "💭" },
  { id: "sell", label: "فروش", emoji: "💰" },
  { id: "educate", label: "آموزش", emoji: "📚" },
  { id: "review", label: "نقد", emoji: "🔍" },
  { id: "announce", label: "اعلام", emoji: "📢" },
  { id: "inspire", label: "الهام", emoji: "🌟" },
];

export const CAPTION_LENGTHS: { id: CaptionLength; label: string; emoji: string }[] = [
  { id: "short", label: "کوتاه", emoji: "✂️" },
  { id: "standard", label: "استاندارد", emoji: "⚖️" },
  { id: "long", label: "طولانی", emoji: "📚" },
];
