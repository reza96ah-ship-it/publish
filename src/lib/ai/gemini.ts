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
      reasoning_effort: "low",
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
      reasoning_effort: "low",
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

// ── Prompt engineering constants ──────────────────────────────────────────

const PERSIAN_LANGUAGE_RULES = `═══ الزامات زبانی (غیرقابل‌مذاکره) ═══

۱) خط فارسی:
- فقط «ی» فارسی (U+06CC)؛ هرگز «ي» عربی (U+064A).
- فقط «ک» فارسی (U+06A9)؛ هرگز «ك» عربی (U+0643).
- بدون «ة» (تای گرد عربی)؛ همیشه «ه».

۲) نیم‌فاصله (ZWNJ، U+200C):
- پیشوندهای فعل: می‌نویسم، نمی‌روم، بی‌فکر (نه «می نویسم» و نه «مینویسم»).
- پسوند جمع «ها»: کتاب‌ها، ایده‌ها، پروژه‌ها.
- پسوند نکره پس از حرف صدادار: خانه‌ای، ایده‌ای.
- یای اضافه پس از حرف صدادار: خانه‌ی پدر، ایده‌ی اصلی.
- پیوندها: این‌که، آن‌که، به‌گونه‌ای، چوب‌لباسی.

۳) نشانه‌های نگارشی فارسی:
- ویرگول: ، (نه comma)
- نقطه‌ویرگول: ؛ (نه semicolon)
- علامت سؤال: ؟ (نه ?)
- گیومه: «» (نه "" یا '')

۴) اعداد فارسی: ۰ ۱ ۲ ۳ ۴ ۵ ۶ ۷ ۸ ۹ (هرگز 0-9)

۵) گرامر فارسی:
- ترتیب کلمات: فاعل-مفعول-فعل (SOV)؛ فعل همیشه آخر جمله.
- فارسی ضمیرپنهان (pro-drop) است؛ ضمیر فاعل را وقتی از سیاق معلوم است حذف کن.
- جمع‌بندی با «ها» برای اسم‌های فارسی: «کتاب‌ها» (نه کُتُب).
- در فارسی «ال» تعریف و «یک» تنکیر وجود ندارد.

۶) طبیعی‌نویسی:
- معادل فارسی واژگان برگزین؛ از وام‌واژه‌های نامأنوس پرهیز کن.
- اصطلاحات انگلیسی را تحت‌اللفظی ترجمه نکن.
- واژگان برگزیده: قالب‌بندی (نه «فرمت»)، پرونده (نه «فایل»)، راهنما (نه «گاید»).`;

const CONTENT_FIDELITY_BLOCK = `═══ اصول وفاداری به محتوا (مهم — محصول/ویژگی اختراع نکن) ═══

۱) موضوع، دقیقاً همان چیزی است که کاربر می‌نویسد:
   - فقط و فقط دربارهٔ همان موضوعی که کاربر داده کپشن بنویس.
   - هرگز محصول، خدمت، رویداد، یا شخصی که کاربر ذکر نکرده، اختراع نکن.

۲) ممنوعیت ساخت productName:
   - نام صفحه/کانال/کسب‌وکار فقط نام «ناشر» است، نه نام محصول.
   - هرگز محصولی با نام ناشر نساز.

۳) ممنوعیت ساخت مشخصات جعلی:
   - اگر موضوع یک محصول ناشناخته است، مشخصات عددی را اختراع نکن.
   - به‌جای عدد ساخته‌شده، توصیف کیفی و دقیق بیاور.

۴) مجاز بودن مشخصات واقعی:
   - اگر موضوع یک محصول شناخته‌شده است، مشخصات واقعی آن را از دانشت بیاور.
   - فقط به آنچه به‌طور عمومی شناخته‌شده پایبند باش.

۵) امضای ناشر:
   - نام ناشر فقط در خط امضا (پایان کپشن، پیش از هشتگ‌ها) بیاید.

۶) اگر موضوع مبهم است:
   - آن را به‌عنوان مضمون محتوایی تفسیر کن، نه اینکه محصولی بسازی.`;

const ANTI_AI_SMELL_BLOCK = `═══ ممنوعیت‌های بوی هوش مصنوعی (مهم‌ترین بخش) ═══

این الگوها را مطلقاً رعایت کن — هر کدام نشانهٔ رو بودن متن توسط هوش مصنوعی است:

۱. ❌ شروع با «سلام» / «درود» / «سلام دوستان» → ✅ مستقیماً با قلاب شروع کن.
۲. ❌ قلاب بله/خیر («آیا X همان Y است؟») → ✅ از فرمول قلاب واقعی استفاده کن.
۳. ❌ لیست «عوامل را در نظر بگیرید» → ✅ نکات خاص و قابل‌اجرا بده.
۴. ❌ نتیجه‌گیری محتاطانه («در نهایت، انتخاب با شماست») → ✅ موضع واضح بگیر.
۵. ❌ CTA کلی («کامنت بگذارید») → ✅ CTA با سؤال خاص.
۶. ❌ ایموجی مکانیکی (یک ایموجی در ابتدای هر خط) → ✅ ۲-۵ ایموجی کل کپشن.
۷. ❌ احتیاط بیش‌ازحد → ✅ جملات قاطع.
۸. ❌ ترجمهٔ تحت‌اللفظی قلاب‌های انگلیسی → ✅ قلاب‌های بومی فارسی.
۹. ❌ ساختار بیش‌ازحد منظم (۳ پاراگراف مساوی با بولت) → ✅ طول پاراگراف‌ها را متنوع کن.
۱۰. ❌ برچسب بخش با هر نشانه‌ای: «درد:» / «راه‌حل:» / «مزیت:» / «✔️ آماده‌سازی:» / «✅ کیفیت:» / «✔️ انرژی:» → ✅ نثر طبیعی و پیوسته. مطلقاً هیچ بولت ✔️ یا ✅ با برچسب استفاده نکن.
۱۱. ❌ مخلوط‌کردن پایهٔ زبانی → ✅ یک پایه انتخاب کن و یکدست کن.
۱۲. ❌ مزیت‌های احساسی کلیشه‌ای («حسِ اعتماد» / «آرامش خاطر» / «تجربه‌ای متفاوت») → ✅ مزیت‌ها را به مشخصات واقعی وصل کن.
۱۳. ❌ قالب ترجمه‌شده «درد ← راه‌حل ← مزیت ← فوریت» → ✅ ساختار طبیعی فارسی، نه ترجمهٔ قالب بازاریابی انگلیسی.
۱۴. ❌ جملات معناری («با هر فنجان، خستگی رو فراموش کن» = translate of "with every cup, forget fatigue") → ✅ جملات طبیعی فارسی بنویس.
۱۵. ❌ «به دنیای لذت‌ها می‌بره» / «تجربه‌ای بی‌نظیر» / «بهترین راه‌حل» → ✅ ادعاهای خاص و قابل‌اعتماد، نه اغراق کلیشه‌ای.

❌ بد (بوی هوش مصنوعی، برچسب ✔️، قالب ترجمه‌شده):
وای…! آیا از کمبود انرژی خسته شدی؟ ☕️
✔️ آماده‌سازی سریع: فقط با آب داغ...
✔️ کیفیت بالا: دانه‌های تازه...
✔️ انرژی مضاعف: با هر فنجان...
موجودی محدود! همین حالا سفارش بده. 🛒

✅ خوب (طبیعی، بدون برچسب، بدون قالب):
صبح هفت، دستات سردن، چشم‌هات خواب‌آلود. یه فنجان قهوه چیزی نیست که وقتش رو داشته باشی.
قهوه فوری نشرینو فقط با آب داغ آماده می‌شه — دو دقیقه و رد می‌شه. طعمش شبیه قهوه‌ایه که تو کافه می‌خوریم، نه قهوه بازاری.
سه طعم داریم: کلاسیک، موکا، کاپوچینو. هر پاکت ۳۰ فنجان درمی‌ره.
برای رزرو پیام بده، ظرف امروز می‌فرستیم. 🛒`;

const HOOK_FORMULAS_BLOCK = `═══ فرمول‌های قلاب (یکی را انتخاب کن) ═══

۱۲ فرمول: آماری، ادعای جسورانه، داستانی، تضادی، سؤال باز، لیست، نقل‌قول، درد-تحریک، شکاف کنجکاوی، اعلام مستقیم، زمان‌محور، خطاب به مخاطب.

نگاشت نقش → قلاب پیشنهادی:
- فروشگاه → آماری، ادعای جسورانه، زمان‌محور
- نقدکننده → داستانی، تضادی
- آموزشگر → سؤال باز، آماری، لیست
- برند → کنجکاوی، زمان‌محور، اعلام مستقیم
- اینفلوئنسر → داستانی، شکاف کنجکاوی
- خبری → fact تازه، زمان‌محور
- تسهیل‌گر بحث → سؤال باز، تضادی`;

const SELF_REVIEW_BLOCK = `═══ بازبینی نهایی (قبل از ارسال، این چک‌لیست را اجرا کن) ═══

الف) بوی هوش مصنوعی: سلام؟ برچسب بخش؟ نتیجه‌گیری محتاطانه؟ CTA کلی؟ ساختار بیش‌ازحد منظم؟ پایه مخلوط؟ → اصلاح کن.
ب) وفاداری به محتوا: محصول جعلی ساختی؟ نام ناشر در بدنه؟ مشخصات جعلی؟ → حذف کن.
ج) تناسب نقش و هدف: ساختار با نقش همخوان است؟ CTA با هدف همخوان است؟
د) زبان: ی و ک فارسی؟ نیم‌فاصله‌ها درست؟ نشانه‌های نگارشی فارسی؟ اعداد فارسی؟ فعل آخر جمله؟`;

const OUTPUT_FORMAT_BLOCK = `═══ قالب خروجی ═══

- فقط و فقط متن نهایی کپشن را بنویس.
- هیچ مقدمه، توضیح، برچسب، یا یادداشت اضافه نده.
- بدون علامت نقل‌قول دور کل متن.
- هشتگ‌ها را در خط آخر کپشن قرار بده.`;

// ── Role/Goal/Tone/Platform maps ──────────────────────────────────────────

const CREATOR_ROLE_MAP: Record<CreatorRole, string> = {
  store: `نقش: فروشگاه آنلاین. رویکرد: «بازرسی واقعی محصول». ساختار: قلاب ← معرفی محصول ← ۲-۳ مزیت ملموس متصل به مشخصه واقعی ← شرایط خرید (اگه کاربر داده) ← CTA خرید. ممنوعات: برچسب بخش، قالب درد/راه‌حل/سود، محصول جعلی.`,
  reviewer: `نقش: بلاگر/نقدکننده. ساختار: قلاب تجربی ← تجربه شخصی ← ۲-۳ نقطه قوت ← ۱-۲ نقطه ضعف صادقانه ← نتیجه‌گیری ← CTA نظر.`,
  educator: `نقش: آموزشگر. ساختار: قلاب ← معرفی موضوع ← نکات کلیدی شماره‌دار ← مثال واقعی ← خلاصه ← CTA ذخیره/اشتراک.`,
  brand: `نقش: برند. ساختار: قلاب (کنجکاوی/زمان‌محور) ← زمینه ← اعلام اصلی ← ارزش برای مشتری ← CTA لینک/پیام.`,
  influencer: `نقش: اینفلوئنسر. ساختار: قلاب (لحظه‌محور/داستانی) ← داستان شخصی ← بینش ← CTA اشتراک تجربه.`,
  news: `نقش: منبع خبری. ساختار: قلاب (fact تازه) ← خبر اصلی ← جزئیات ← بافت ← CTA بازنشر.`,
  community: `نقش: تسهیل‌گر بحث. ساختار: قلاب (سؤال جنجالی) ← زمینه ← دیدگاه ← CTA بحث.`,
};

const CONTENT_GOAL_MAP: Record<ContentGoal, string> = {
  sell: `هدف: فروش. CTA: خرید/سفارش/موجودی محدود. ساختار: hook ← مزایا ← CTA خرید.`,
  educate: `هدف: آموزش. CTA: ذخیره/اشتراک. ساختار: hook ← مراحل/نکات ← CTA ذخیره.`,
  review: `هدف: نقد. CTA: نظر شما. ساختار: hook ← تجربه ← نقاط قوت/ضعف ← نتیجه‌گیری ← CTA نظر.`,
  announce: `هدف: اعلام. CTA: لینک/پیام. ساختار: hook ← اعلام ← ارزش ← CTA لینک.`,
  engage: `هدف: تعامل. CTA: کامنت/بحث. ساختار: hook ← زمینه ← دیدگاه ← CTA سؤال.`,
  inspire: `هدف: الهام. CTA: اشتراک. ساختار: hook ← داستان ← بینش ← CTA اشتراک.`,
};

const TONE_MAP: Record<Tone, { label: string; register: string; guidance: string }> = {
  formal: { label: "رسمی", register: "معیار", guidance: `لحن: رسمی. افعال: می‌نویسم، می‌رود، است. خطاب: شما. واژگان ادبی-عربی مجاز. طول جمله: ۱۵-۳۰ واژه. حداکثر ۱ ایموجی. hook خبری. CTA رسمی.` },
  friendly: { label: "صمیمی", register: "شکسته‌نویسی", guidance: `لحن: صمیمی. افعال: می‌خوام، می‌ره، هسته. خطاب: شما/تو. واژگان روزمره. طول جمله: ۵-۱۵ واژه. ۳-۵ ایموجی گرم. hook با سؤال یا «وای…!». CTA صمیمی.` },
  professional: { label: "حرفه‌ای", register: "معیار با نرمی", guidance: `لحن: حرفه‌ای. افعال: می‌نویسم، می‌رود. خطاب: شما. واژگان تخصصی. طول جمله: ۱۰-۲۰ واژه. ۱-۲ ایموجی. hook: «آیا می‌دانستید…؟». CTA ارزش‌محور.` },
  storytelling: { label: "روایی", register: "معیار اول‌شخص", guidance: `لحن: داستان‌گویی. افعال: می‌رفتم، دیدم. ضمیر اول شخص. ساختار سه‌پرده. واژگان حسی. ۱-۳ ایموجی نرم. hook: «چند روز پیش…». CTA تأملی.` },
  sales: { label: "فروش", register: "نیمه‌رسمی متقاعدکننده", guidance: `لحن: فروش. متقاعدکننده. ساختار: قلاب ← معرفی ← مزیت ← CTA. واژگان: ویژه، محدود. ❌ ممنوع: قالب درد/راه‌حل/سود. ایموجی: 🛒 ⏰ ✅ 🔥.` },
  educational: { label: "آموزشی", register: "معیار روشنگرانه", guidance: `لحن: آموزشی. ساختار: سؤال ← معرفی ← نکات شماره‌دار ← مثال. ۱-۳ ایموجی (✅ 💡 📝). hook: «آموزش:»، «چطور…». CTA: «ذخیره کن 📌».` },
  poetic: { label: "ادبی", register: "معیار فاخر", guidance: `لحن: ادبی. واژگان فاخر (بهار، شوق، سکوت). جملات موزون. آرایه‌های ادبی. ۰-۲ ایموجی. hook: «قهوه، بوی خاطره است.». CTA تأملی.` },
};

function platformGuidance(platform: Platform): string {
  const map: Record<Platform, string> = {
    instagram: `پلتفرم: اینستاگرام. طول: ۲۰۰-۸۰۰ کاراکتر. ایموجی: ۳-۶. هشتگ: ۵-۱۲ (فارسی+انگلیسی). CTA: کامنت/لینک بیو/ذخیره. ۱-۲ خط اول قبل از «… ادامه» مهم.`,
    telegram: `پلتفرم: تلگرام. طول: ۱۵۰-۶۰۰ کاراکتر. ایموجی: ۲-۴. هشتگ: ۳-۸. لحن: صمیمی و مستقیم. CTA: عضو کانال/پیام دهید.`,
    linkedin: `پلتفرم: لینکدین. طول: ۳۰۰-۱۲۰۰ کاراکتر. ایموجی: ۰-۲. هشتگ: ۳-۵ (انگلیسی). لحن: معیار رسمی. CTA: نظرتان را بنویسید.`,
    rubika: `پلتفرم: روبیکا. طول: ۱۵۰-۵۰۰ کاراکتر. ایموجی: ۲-۴. هشتگ: ۳-۸ (فارسی، خط زیر). لحن: نیمه‌رسمی. CTA: پیام دهید.`,
    bale: `پلتفرم: بله. طول: ۱۵۰-۵۰۰ کاراکتر. ایموجی: ۲-۴. هشتگ: ۳-۸ (فارسی، خط زیر). لحن: نیمه‌رسمی. CTA: پیام دهید.`,
    eitaa: `پلتفرم: ایتا. طول: ۱۵۰-۵۰۰ کاراکتر. ایموجی: ۲-۴. هشتگ: ۳-۸ (فارسی، خط زیر). لحن: نیمه‌رسمی تا صمیمی. CTA: پیام دهید/کد به ادمین.`,
  };
  return map[platform];
}

// ── Main 12-section prompt builder ────────────────────────────────────────

function buildCaptionSystem(
  platform: Platform,
  ws?: WorkspaceContext,
  tone?: Tone,
  role?: CreatorRole,
  goal?: ContentGoal,
  length?: CaptionLength,
  voiceExamples?: string,
): string {
  const sections: string[] = [];
  sections.push("تو یک نویسندهٔ حرفه‌ای کپشن برای شبکه‌های اجتماعی فارسی‌زبان هستی. کپشن‌هایی که می‌نویسی باید طبیعی، اصیل و کاملاً فارسی باشند — نه ترجمه‌شده از انگلیسی.");
  if (role) sections.push(`═══ نقش سازنده (مهم‌ترین بخش — ساختار کپشن به این بستگی دارد) ═══\n${CREATOR_ROLE_MAP[role]}`);
  if (goal) sections.push(`═══ هدف محتوا ═══\n${CONTENT_GOAL_MAP[goal]}`);
  sections.push(CONTENT_FIDELITY_BLOCK);
  sections.push(ANTI_AI_SMELL_BLOCK);
  sections.push(HOOK_FORMULAS_BLOCK);
  if (length) sections.push(`═══ طول کپشن ═══\nطول هدف: ${CAPTION_LENGTH_MAP[length].charRange} کاراکتر.\n${CAPTION_LENGTH_MAP[length].guidance}\nمراق باش طولانی شدن به معنای حشو و کلیشه نیست.`);
  if (voiceExamples?.trim()) sections.push(`═══ نمونه‌های واقعی سبک نگارش ناشر (بسیار مهم — این سبک را تقلید کن) ═══\nاین نمونه‌های کپشن قبلی ناشر است. ساختار جملات، تراکم ایموجی، انتخاب واژگان، و سبک CTA را تقلید کن — اما موضوع جدید را بنویس (نمونه‌ها را کپی نکن):\n\n${voiceExamples.trim()}`);
  sections.push(PERSIAN_LANGUAGE_RULES);
  if (tone) sections.push(`═══ لحن و سبک ═══\n${TONE_MAP[tone].guidance}`);
  sections.push(`═══ راهنمای پلتفرم ═══\n${platformGuidance(platform)}`);
  const wsParts: string[] = [];
  if (ws?.name) wsParts.push(`نام ناشر/کانال (فقط در خط امضای پایانی بیاور، نه در بدنه): ${ws.name}`);
  if (ws?.brandVoice) wsParts.push(`لحن برند: ${ws.brandVoice}`);
  if (ws?.contentGuidelines) wsParts.push(`راهنمای محتوایی: ${ws.contentGuidelines}`);
  if (ws?.defaultHashtags) wsParts.push(`هشتگ‌های پیش‌فرض (در انتها): ${ws.defaultHashtags}`);
  if (ws?.captionFooter) wsParts.push(`امضای ثابت: ${ws.captionFooter}`);
  if (wsParts.length > 0) sections.push(`═══ بافت ناشر (نام ناشر فقط برای امضاست، نه نام محصول) ═══\n${wsParts.join("\n")}`);
  sections.push(OUTPUT_FORMAT_BLOCK);
  sections.push(SELF_REVIEW_BLOCK);
  return sections.join("\n\n");
}
