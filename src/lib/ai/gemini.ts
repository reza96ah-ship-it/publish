/**
 * Persian AI Assistant — GapGPT (OpenAI-compatible) primary + Gemini/z-ai fallback.
 *
 * GapGPT is an OpenAI-compatible gateway supporting GPT-4o, GPT-5, Claude,
 * Gemini, Grok, and Qwen — all through one endpoint. Works globally (no geo-blocks).
 *
 * Base URL: https://api.gapgpt.app/v1
 * Docs: https://gapgpt.app/platform-v2/docs/quickstart
 *
 * Fallback chain:
 *   1. GapGPT (if GAPGPT_API_KEY is set) — OpenAI-compatible, works everywhere
 *   2. Google Gemini (if GEMINI_API_KEY is set) — free tier, region-limited
 *   3. z-ai-web-dev-sdk (sandbox default) — free, shared quota
 *
 * IMPORTANT: Must be used in backend code only.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import ZAI from "z-ai-web-dev-sdk";

export type Platform = "instagram" | "telegram" | "linkedin" | "rubika" | "bale" | "eitaa";

export type Tone =
  | "friendly"
  | "formal"
  | "professional"
  | "storytelling"
  | "sales"
  | "educational"
  | "poetic";

/** Creator role — determines the perspective and hashtag intent */
export type CreatorRole =
  | "influencer"
  | "store"
  | "reviewer"
  | "educator"
  | "brand"
  | "news"
  | "community";

/** Content goal — determines the structure and CTA */
export type ContentGoal =
  | "sell"
  | "educate"
  | "review"
  | "announce"
  | "engage"
  | "inspire";

/** Caption length — controls char range and token budget */
export type CaptionLength = "short" | "standard" | "long";

/** Hashtag suggestion with explanation */
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

const CAPTION_LENGTH_MAP: Record<CaptionLength, { charRange: string; guidance: string; maxTokens: number }> = {
  short: { charRange: "۱۵۰–۳۵۰", guidance: "کوتاه و ضربتی. hook + یک پاراگراف + CTA.", maxTokens: 800 },
  standard: { charRange: "۴۰۰–۸۰۰", guidance: "طول استاندارد. hook + ۲-۳ پاراگراف + CTA + هشتگ.", maxTokens: 2048 },
  long: { charRange: "۸۰۰–۲۰۰۰", guidance: "طولانی و جامع. hook + ۳-۵ پاراگراف + جزئیات + CTA + هشتگ.", maxTokens: 3072 },
};

const ROLE_HASHTAG_INTENT: Record<CreatorRole, string> = {
  influencer: "هشتگ‌های سبک زندگی، ترند و سرگرمی",
  store: "هشتگ‌های خرید، فروش، قیمت، تخفیف",
  reviewer: "هشتگ‌های نقد، بررسی، مقایسه، تجربه کاربری",
  educator: "هشتگ‌های آموزش، نکته، راهنما، یادگیری",
  brand: "هشتگ‌های برندینگ، معرفی محصول، هویت سازمانی",
  news: "هشتگ‌های خبری، تازه‌ها، رویداد",
  community: "هشتگ‌های گفتگو، نظر سنجی، بحث",
};

const GOAL_HASHTAG_INTENT: Record<ContentGoal, string> = {
  sell: "هشتگ‌های خرید، سفارش، تخفیف، موجودی",
  educate: "هشتگ‌های آموزش، نکته، راهنما، ترفند",
  review: "هشتگ‌های نقد، بررسی، مقایسه، تجربه",
  announce: "هشتگ‌های اعلام، تازه، جدید، رویداد",
  engage: "هشتگ‌های تعامل، نظر، سوال، گفتگو",
  inspire: "هشتگ‌های الهام‌بخش، انگیزشی، زیبا",
};

export interface WorkspaceContext {
  name?: string;
  brandVoice?: string;
  contentGuidelines?: string;
  defaultHashtags?: string;
  captionFooter?: string;
  persianDigits?: boolean;
}

const GAPGPT_BASE_URL = "https://api.gapgpt.app/v1";
// gpt-4o-mini: fast, excellent Persian, works reliably on GapGPT.
// Alternatives (tested): gapgpt-qwen-3.5-thinking (needs max_tokens:2000+ for reasoning).
// gemma-3-27b-it: listed but upstream returns errors (as of 2026-06).
const GAPGPT_MODEL = "gpt-4o-mini";

// ── Gemini singleton ───────────────────────────────────────────────────────
let _gemini: GoogleGenerativeAI | null = null;

function getGemini(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!_gemini) {
    _gemini = new GoogleGenerativeAI(apiKey);
  }
  return _gemini;
}

// ── z-ai singleton (last resort fallback) ──────────────────────────────────
let _zai: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

function hasGapGPT(): boolean {
  return !!process.env.GAPGPT_API_KEY;
}

function hasGemini(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ── Caption generation ─────────────────────────────────────────────────────

/**
 * Generate a Persian caption (non-streaming).
 * Tries GapGPT → Gemini → z-ai in order.
 */
export async function generateCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: Tone,
  role?: CreatorRole,
  goal?: ContentGoal,
  length?: CaptionLength,
  variation: number = 0,
): Promise<string> {
  const system = buildCaptionSystem(platform, workspace, tone, role, goal, length);
  const temp = Math.min(0.8 + variation * 0.05, 1.2);
  const maxTokens = length ? CAPTION_LENGTH_MAP[length].maxTokens : 2048;

  // Try GapGPT first (OpenAI-compatible)
  if (hasGapGPT()) {
    try {
      const text = await gapgptComplete(system, `موضوع: ${topic}\n\nکپشن را بنویس.`, temp, maxTokens);
      if (text && text.trim().length > 10) return text;
    } catch (err) {
      console.error("[ai] GapGPT error, trying Gemini:", err);
    }
  }

  // Try Gemini
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `${system}\n\nموضوع: ${topic}\n\nکپشن را بنویس.`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim().length > 10) return text;
    } catch (err) {
      console.error("[ai] Gemini error, falling back to z-ai:", err);
    }
  }

  // Fallback: z-ai-web-dev-sdk
  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    model: "glm-4-plus",
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: `موضوع: ${topic}\n\nکپشن را بنویس.` },
    ],
    thinking: { type: "disabled" },
    temperature: 0.75,
  });
  return completion.choices?.[0]?.message?.content ?? "";
}

/**
 * Stream a Persian caption (async generator yielding text chunks).
 * Tries GapGPT streaming → Gemini streaming → z-ai streaming.
 */
export async function* streamCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: Tone,
  role?: CreatorRole,
  goal?: ContentGoal,
  length?: CaptionLength,
  variation: number = 0,
): AsyncGenerator<string, void, unknown> {
  const system = buildCaptionSystem(platform, workspace, tone, role, goal, length);
  const temp = Math.min(0.8 + variation * 0.05, 1.2);
  const maxTokens = length ? CAPTION_LENGTH_MAP[length].maxTokens : 2048;

  // Try GapGPT streaming first
  if (hasGapGPT()) {
    try {
      let yielded = false;
      for await (const chunk of gapgptStream(system, `موضوع: ${topic}\n\nکپشن را بنویس.`, temp, maxTokens)) {
        yielded = true;
        yield chunk;
      }
      if (yielded) return; // Success — don't fall through
    } catch (err) {
      console.error("[ai] GapGPT stream error, trying Gemini:", err);
    }
  }

  // Try Gemini streaming
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const prompt = `${system}\n\nموضوع: ${topic}\n\nکپشن را بنویس.`;
      const stream = await model.generateContentStream(prompt);
      let yielded = false;
      for await (const chunk of stream) {
        const text = chunk.text();
        if (text) {
          yielded = true;
          yield text;
        }
      }
      if (yielded) return;
    } catch (err) {
      console.error("[ai] Gemini stream error, falling back to z-ai:", err);
    }
  }

  // Fallback: z-ai-web-dev-sdk streaming
  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    model: "glm-4-plus",
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: `موضوع: ${topic}\n\nکپشن را بنویس.` },
    ],
    thinking: { type: "disabled" },
    temperature: 0.75,
    stream: true,
  });

  const reader = (completion as any).getReader?.();
  if (reader) {
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") return;
          try {
            const json = JSON.parse(jsonStr);
            const delta = json.choices?.[0]?.delta?.content;
            if (delta) yield delta as string;
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } else {
    const text = await generateCaption(topic, platform, workspace, tone);
    yield text;
  }
}

// ── Hashtag suggestion ─────────────────────────────────────────────────────

/**
 * Suggest 10 Persian + English hashtags for a topic.
 * Tries GapGPT → Gemini → z-ai.
 */
export async function suggestHashtags(
  topic: string,
  platform: Platform,
  existingHashtags?: string,
  role?: CreatorRole,
  goal?: ContentGoal,
): Promise<HashtagSuggestion[]> {
  const roleIntent = role ? ROLE_HASHTAG_INTENT[role] : "";
  const goalIntent = goal ? GOAL_HASHTAG_INTENT[goal] : "";

  const system = `تو یک متخصص هشتگ‌های شبکه‌های اجتماعی برای مخاطبان ایرانی هستی.
برای موضوع داده شده، ۱۰ هشتگ مرتبط پیشنهاد بده — ترکیبی از فارسی و انگلیسی.
${roleIntent ? `تمرکز: ${roleIntent}.` : ""}
${goalIntent ? `هدف: ${goalIntent}.` : ""}
هشتگ‌های ترند ایرانی و مرتبط با موضوع را انتخاب کن.
هر هشتگ را در یک خط جداگانه بنویس، به این شکل: #هشتگ — دلیل انتخاب
مثال:
#قهوه — هشتگ اصلی و پرجستجو
#کافه — هشتگ مرتبط با محیط مصرف
#coffee_lovers — هشتگ انگلیسی پرطرفدار`;

  const userMsg = `موضوع: ${topic}\nپلتفرم: ${platform}\nهشتگ‌های موجود: ${existingHashtags || "ندارد"}\n\n۱۰ هشتگ پیشنهادی با دلیل:`;
  let text = "";

  // Try GapGPT
  if (hasGapGPT()) {
    try {
      text = await gapgptComplete(system, userMsg, 0.8);
    } catch (err) {
      console.error("[ai] GapGPT hashtag error, trying Gemini:", err);
    }
  }

  // Try Gemini
  if (!text && hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(`${system}\n\n${userMsg}`);
      text = result.response.text();
    } catch (err) {
      console.error("[ai] Gemini hashtag error, falling back to z-ai:", err);
    }
  }

  // Fallback: z-ai
  if (!text) {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      model: "glm-4-plus",
      messages: [
        { role: "assistant", content: system },
        { role: "user", content: userMsg },
      ],
      thinking: { type: "disabled" },
      temperature: 0.8,
    });
    text = completion.choices?.[0]?.message?.content ?? "";
  }

  return parseEnrichedHashtags(text);
}

/** Parse "#tag — reason" line format into HashtagSuggestion[] */
export function parseEnrichedHashtags(text: string): HashtagSuggestion[] {
  const lines = text.split("\n");
  const results: HashtagSuggestion[] = [];

  for (const line of lines) {
    const trimmed = line.trim().replace(/^["'\d.\-\s]+/, "");
    if (!trimmed.startsWith("#")) continue;

    // Try to split on — (em dash) or - (dash) or ،
    const dashMatch = trimmed.match(/^(#\S+)\s*[—–-]\s*(.+)/);
    if (dashMatch) {
      results.push({ tag: dashMatch[1], reason: dashMatch[2].trim() });
    } else {
      // Fallback: just the tag, no reason
      const tag = trimmed.split(/[\s,،]/)[0];
      if (tag && tag.length > 1) {
        results.push({ tag, reason: "" });
      }
    }
  }

  return results.slice(0, 10);
}

// ── Smart reply (for inbox) ─────────────────────────────────────────────────

/**
 * Generate a smart reply for an inbox message (comment/DM).
 * Tries GapGPT → Gemini → z-ai.
 */
export async function suggestReply(
  message: string,
  platform: Platform,
  brandVoice?: string,
): Promise<string> {
  const system = `تو یک دستیار پاسخگویی فارسی برای شبکه‌های اجتماعی هستی.
به پیام کاربر یک پاسخ کوتاه، مودبانه و مرتبط به فارسی بنویس.
${brandVoice ? `لحن برند: ${brandVoice}` : ""}
پاسخ باید کوتاه (۱-۳ جمله) و دوستانه باشد.`;

  const userMsg = `پیام کاربر: ${message}\nپلتفرم: ${platform}\n\nپاسخ:`;
  let text = "";

  if (hasGapGPT()) {
    try {
      text = await gapgptComplete(system, userMsg, 0.7);
    } catch {
      // fall through
    }
  }

  if (!text && hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-2.0-flash" });
      const result = await model.generateContent(`${system}\n\n${userMsg}`);
      text = result.response.text();
    } catch {
      // fall through
    }
  }

  if (!text) {
    const zai = await getZAI();
    const completion = await zai.chat.completions.create({
      model: "glm-4-plus",
      messages: [
        { role: "assistant", content: system },
        { role: "user", content: userMsg },
      ],
      thinking: { type: "disabled" },
      temperature: 0.7,
    });
    text = completion.choices?.[0]?.message?.content ?? "";
  }

  return text;
}

// ── GapGPT helpers (OpenAI-compatible fetch) ───────────────────────────────

async function gapgptComplete(system: string, user: string, temperature: number, maxTokens: number = 2048): Promise<string> {
  const res = await fetch(`${GAPGPT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GAPGPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: GAPGPT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GapGPT ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function* gapgptStream(system: string, user: string, temperature: number, maxTokens: number = 2048): AsyncGenerator<string, void, unknown> {
  const res = await fetch(`${GAPGPT_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GAPGPT_API_KEY}`,
    },
    body: JSON.stringify({
      model: GAPGPT_MODEL,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GapGPT ${res.status}: ${err}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") return;
        try {
          const json = JSON.parse(jsonStr);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta as string;
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }
}

// ── Persian prompt builder ─────────────────────────────────────────────────

function buildCaptionSystem(
  platform: Platform,
  ws?: WorkspaceContext,
  tone?: Tone,
  role?: CreatorRole,
  goal?: ContentGoal,
  length?: CaptionLength,
): string {
  const platformLabels: Record<Platform, string> = {
    instagram: "اینستاگرام (پست فید)",
    telegram: "تلگرام (کانال)",
    linkedin: "لینکدین (پست)",
    rubika: "روبیکا (کانال)",
    bale: "بله (کانال)",
    eitaa: "ایتا (کانال)",
  };

  const platformRules: Record<Platform, string> = {
    instagram: "طول: ۱۵۰–۴۰۰ کاراکتر. حداکثر ۳۰ هشتگ در انتها.",
    telegram: "طول: تا ۱۰۲۴ کاراکتر. متن خوانا با پاراگراف‌های کوتاه.",
    linkedin: "طول: ۳۰۰–۸۰۰ کاراکتر. سوال در پایان برای تعامل.",
    rubika: "طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.",
    bale: "طول: تا ۱۰۲۴ کاراکتر. متن خوانا.",
    eitaa: "طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.",
  };

  // ── Per-tone DETAILED linguistic instructions ──────────────────────────
  // The key fix: instead of one word ("لحن: صمیمی"), inject concrete rules
  // for verb forms, pronouns, vocabulary, sentence length, emoji, hooks, CTA.
  // This makes tones GENUINELY different, not just minor wording changes.
  const toneInstructions: Record<Tone, string> = {
    friendly: `لحن: صمیمی و دوستانه (محاوره‌ای).
قوانین زبانی این لحن:
- تمام افعال محاوره‌ای: «می‌رم، می‌ری، می‌ره، میریم، میرید، میرن، می‌شه، می‌گه، داره میاد، بریم» (هرگز «می‌روم، می‌شود، می‌گوید، دارم می‌آیم»).
- ضمیر مخاطب: «تو» یا «شما» (محترمانه‌ی نزدیک)؛ هرگز «ایشان».
- واژگان روزمره فارسی: «گرفتن، دیدن، دادن، خرید، شروع، کار، عالی، باحال»؛ واژگان ادبی-عربی ممنوع (دریافت، ملاحظه، ارائه ممنوع).
- طول جمله: ۵ تا ۱۵ واژه. جملات کوتاه و پونچی.
- hook با سؤال یا «وای…!» یا «تا حالا دقت کردی؟».
- ۳ تا ۵ ایموجی گرم و صمیمی (☕️ 😍 ✨ 🤍 🙏).
- CTA صمیمی: «کامنت کن ببینم»، «بگو ببینم»، «شما چی؟».`,

    formal: `لحن: رسمی و اداری (معیار نوشتاری).
قوانین زبانی این لحن:
- تمام افعال معیار و اداری: «می‌رود، می‌گوید، می‌باشد، گردیده است، ارائه می‌نماید، انجام می‌دهد» (هرگز «می‌شه، می‌گه، می‌ره، می‌باشه»).
- ضمیر: «شما» و «ایشان» و «آن‌ها»؛ هرگز «تو، اون، اونا».
- واژگان ادبی-عربی: «دریافت، ملاحظه، ارائه، بررسی، خریداری، بهره‌مندی، آغاز، انجام، بازگشت، مبتنی بر، در راستای، متعاقب».
- طول جمله: ۱۵ تا ۳۰ واژه با بندهای فرعی و پیچیده.
- حداکثر ۱ ایموجی تابعی یا بدون ایموجی.
- hook خبری: «مطالعات نشان می‌دهد…»، «بر اساس گزارش…».
- CTA رسمی: «نظر خود را بیان فرمایید»، «با ما در تماس باشید».`,

    professional: `لحن: حرفه‌ای و متخصصانه (معیار اما بدون سنگینی اداری).
قوانین زبانی این لحن:
- افعال معیار اما روان: «می‌رود، می‌گوید، است، انجام می‌دهد، تأثیر می‌گذارد، نشان می‌دهد» — افعال سنگین اداری «می‌باشد، گردیده، می‌نماید» ممنوع.
- ضمیر: «شما» و «آن‌ها».
- واژگان تخصصی دامنه: «کافئین، آنتی‌اکسیدان، استخراج، دم‌گیری، فرآیند، ترکیب، مؤلفه، بهینه‌سازی».
- طول جمله: ۱۰ تا ۲۰ واژه. از فهرست شماره‌دار برای نکات کلیدی استفاده کن.
- ۱ تا ۲ ایموجی حرفه‌ای (☕️ 📊 ✓).
- hook: «آیا می‌دانستید…؟» یا «بر اساس تحقیقات…» یا «۳ نکته کلیدی درباره…».
- CTA ارزش‌محور: «برای اطلاعات بیشتر کلیک کنید»، «در کامنت‌ها سوالتان را بپرسید».`,

    storytelling: `لحن: داستان‌گویی و روایی (شخصی، احساسی).
قوانین زبانی این لحن:
- افعال غالباً گذشته محاوره‌ای: «رفتم، دیدم، نشستم، فهمیدم، یادم میاد، یه روز…».
- ضمیر اول شخص «من» محوری؛ مخاطب «تو» یا «شما».
- ساختار سه‌پرده: ۱) آغاز با زمان/مکان ۲) نقطه عطف یا کشف ۳) تأمل + CTA.
- واژگان حسی-توصیفی: «عطر، رنگ، خاطره، لحظه، حس، یاد، صدا».
- ۱ تا ۳ ایموجی نرم و توصیفی (☕️ 🤍 ✨).
- hook با «چند روز پیش…»، «یادم میاد…»، «یه روز…».
- CTA تأملی: «شما کدوم خاطره رو یادتونه؟»، «تجربه‌تون رو بنویسید».`,

    sales: `لحن: فروش و تبلیغاتی (فوری، ترغیب‌کننده، کمیابی).
قوانین زبانی این لحن:
- افعال امری غالب: «بیا، نگو، بخر، تست کن، کلیک کن، سفارش بده، عجله کن، فرصت رو از دست نده».
- ضمیر مستقیم: «تو» و «شما».
- واژگان فروش: «تخفیف، فرصت محدود، فقط، ویژه، تضمینی، عجله کن، همین الان، انحصاری، ناموجود».
- طول جمله: ۳ تا ۱۰ واژه. کوتاه و ضربتی.
- از bullet (✅) برای لیست مزایا استفاده کن.
- ۴ تا ۷ ایموجی فوریت (⏰ 🔥 ⚡️ 💥 ✅ 🎯 🎁).
- hook با کمیابی: «فقط تا امشب!»، «آخرین فرصت!»، «تخفیف ویژه!».
- CTA اقدام مستقیم: «همین الان سفارش بده 👇»، «کلیک کن و خرید کن».`,

    educational: `لحن: آموزشی و راهنما (معیارِ در دسترس، گام‌به‌گام).
قوانین زبانی این لحن:
- افعال امری و حال ساده: «بریز، بگذار، صبر کن، می‌جوشد، توجه کن، دقت کن، حتماً انجام بده».
- ضمیر: «شما».
- واژگان آموزشی: «مرحله، روش، نکته، مهم، توجه، دقت، حتماً، توجه کنید».
- ساختار: فهرست مراحل شماره‌دار (۱. ۲. ۳.) یا bullet.
- ۱ تا ۳ ایموجی آموزشی (✅ ✓ 💡 ⚠️ 📝).
- hook با «آموزش:»، «چطور…»، «نکته:»، «راهنمای…».
- CTA: «ذخیره کن برای بعد 📌»، «بفرست برای کسی که لازم داره»، «کامنت کن اگه سوال داری».`,

    poetic: `لحن: احساسی و شاعرانه (ادبی، تشبیه‌محور).
قوانین زبانی این لحن:
- معیارِ ادبی با صرف‌های شاعرانه: «می‌رود، می‌بافد، می‌آفریند، بمان، بنشین، بگذار».
- ضمیر محاوره‌ای صمیمی-ادبی: «تو» و «ما» یا بدون ضمیر.
- واژگان ادبی-حسی: «پرده، نغمه، سکوت، سحر، شبنم، راز، خاطره، شوق، دردا، طلوع، نسیم».
- طول جمله: ۱۰ تا ۲۵ واژه با ساختار موازی و ریتمیک.
- بدون bullet و بدون فهرست.
- ۰ تا ۲ ایموجی زیبایی‌شناختی (☕️ 🌙 🍂 ✨ 🤍).
- hook جوی-توصیفی: «قهوه، بوی خاطره است.»، «هر صبح، با فنجانی…».
- CTA تأملی: «تو چه می‌بینی؟»، «در سکوتِ عطرش، روزت را بیاب».`,
  };

  const toneInstruction = tone ? toneInstructions[tone] : "";

  return `تو یک متخصص تولید محتوای فارسی برای شبکه‌های اجتماعی هستی.
کپشن‌هایی که می‌نویسی باید طبیعی، اصیل و کاملاً فارسی باشند — نه ترجمه‌شده از انگلیسی.

قوانین کلی زبانی:
۱. ارقام فارسی (۰۱۲۳۴۵۶۷۸۹) به‌جای لاتین.
۲. از نیم‌فاصله (ـ) در پیشوندها و پسوندهای فعلی و جمع‌های یای نکره استفاده کن: می‌روم، کتاب‌ها، گفت‌وگو، بی‌ادب.
۳. هشتگ‌ها با خط زیر و فارسی. حداکثر ۸ هشتگ در انتها.
۴. از ایموجی‌های رنگ پوستی پرهیز کن.

پلتفرم هدف: ${platformLabels[platform]}
${platformRules[platform]}

${toneInstruction}

${ws?.brandVoice ? `لحن برند (در صورت تضاد با لحن بالا، این اولویت دارد): ${ws.brandVoice}` : ""}
${ws?.contentGuidelines ? `دستورالعمل‌های محتوایی: ${ws.contentGuidelines}` : ""}
${ws?.defaultHashtags ? `هشتگ‌های پایه (حتماً در انتها): ${ws.defaultHashtags}` : ""}
${ws?.captionFooter ? `امضای پایانی: ${ws.captionFooter}` : ""}

ساختار خروجی:
۱. hook یک‌خطی جذاب (متناسب با لحن)
۲. بدنه ۲–۴ پاراگراف کوتاه
۳. CTA (دعوت به اقدام، متناسب با لحن)
۴. خط خالی
۵. هشتگ‌ها

مهم: لحن باید کاملاً در افعال، ضمایر، واژگان و ساختار جمله مشهود باشد. خواننده با خواندن چند کلمه باید بتواند لحن را تشخیص دهد.

${role ? `نقش خالق محتوا: ${CREATOR_ROLES.find(r => r.id === role)?.label ?? role}\nبا دیدگاه این نقش بنویس — مثلاً فروشگاه از زبان فروشنده می‌نویسد، نقدکننده از زبان آزمایش‌گر واقعی.` : ""}
${goal ? `هدف محتوا: ${CONTENT_GOALS.find(g => g.id === goal)?.label ?? goal}\nساختار کپشن باید این هدف را دنبال کند — مثلاً فروش = hook + مزایا + CTA خرید، آموزش = hook + مراحل + CTA ذخیره.` : ""}
${length ? `طول کپشن: ${CAPTION_LENGTH_MAP[length].charRange} کاراکتر. ${CAPTION_LENGTH_MAP[length].guidance}` : ""}

قوانین محتوایی:
۱. فقط ویژگی‌هایی که در موضوع ورودی ذکر شده را ذکر کن. اگر مشخصاتی در موضوع نیست، به جای اعداد، از زبان مزیت‌محور استفاده کن (مثلاً «عکس‌های حرفه‌ای» به جای «دوربین ۲۰۰ مگاپیکسل»).
۲. از ساختار «سلام» به‌عنوان شروع خودداری کن. از hook جذاب استفاده کن.
۳. از سوالات بله/خیر به‌عنوان hook خودداری کن.
۴. برچسب‌های قالب (مثل «مشکل»، «راه‌حل»، «مزایا») را در خروجی ننویس — ساختار باید طبیعی باشد.

فقط کپشن را برگرد — بدون توضیح اضافه، بدون عبارت «این کپشن...».`;
}
