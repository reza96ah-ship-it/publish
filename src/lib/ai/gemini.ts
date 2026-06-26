/**
 * Persian AI Assistant — Google Gemini (free tier) with z-ai fallback.
 *
 * Gemini 1.5 Flash free tier: 15 RPM, 1,500 requests/day, 1M tokens/min.
 * Get a free API key: https://aistudio.google.com/app/apikey
 * Set GEMINI_API_KEY in .env
 *
 * Fallback chain:
 *   1. Google Gemini (if GEMINI_API_KEY is set) — free, excellent Persian
 *   2. z-ai-web-dev-sdk (sandbox default) — free, shared quota
 *
 * IMPORTANT: Must be used in backend code only.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import ZAI from "z-ai-web-dev-sdk";

export type Platform = "instagram" | "telegram" | "linkedin" | "rubika" | "bale" | "eitaa";

export interface WorkspaceContext {
  name?: string;
  brandVoice?: string;
  contentGuidelines?: string;
  defaultHashtags?: string;
  captionFooter?: string;
  persianDigits?: boolean;
}

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

// ── z-ai singleton (fallback) ──────────────────────────────────────────────
let _zai: ZAI | null = null;

async function getZAI(): Promise<ZAI> {
  if (!_zai) {
    _zai = await ZAI.create();
  }
  return _zai;
}

function hasGemini(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ── Caption generation ─────────────────────────────────────────────────────

/**
 * Generate a Persian caption (non-streaming).
 * Tries Gemini first, falls back to z-ai.
 */
export async function generateCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: "formal" | "friendly" | "playful" | "professional",
): Promise<string> {
  const system = buildCaptionSystem(platform, workspace, tone);
  const prompt = `${system}\n\nموضوع: ${topic}\n\nکپشن را بنویس.`;

  // Try Gemini first
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
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
 * Tries Gemini streaming first, falls back to z-ai streaming.
 */
export async function* streamCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: "formal" | "friendly" | "playful" | "professional",
): AsyncGenerator<string, void, unknown> {
  const system = buildCaptionSystem(platform, workspace, tone);
  const prompt = `${system}\n\nموضوع: ${topic}\n\nکپشن را بنویس.`;

  // Try Gemini streaming first
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const stream = await model.generateContentStream(prompt);
      let yielded = false;
      for await (const chunk of stream) {
        const text = chunk.text();
        if (text) {
          yielded = true;
          yield text;
        }
      }
      if (yielded) return; // Success — don't fall through to z-ai
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

  // Parse SSE frames from z-ai
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
    // If stream isn't supported, return the full response
    const text = await generateCaption(topic, platform, workspace, tone);
    yield text;
  }
}

// ── Hashtag suggestion ─────────────────────────────────────────────────────

/**
 * Suggest 10 Persian + English hashtags for a topic.
 * Tries Gemini first, falls back to z-ai.
 */
export async function suggestHashtags(
  topic: string,
  platform: Platform,
  existingHashtags?: string,
): Promise<string[]> {
  const system = `تو یک متخصص هشتگ‌های شبکه‌های اجتماعی برای مخاطبان ایرانی هستی.
برای موضوع داده شده، ۱۰ هشتگ مرتبط پیشنهاد بده — ترکیبی از فارسی و انگلیسی.
هشتگ‌های ترند ایرانی و مرتبط با موضوع را انتخاب کن.
فقط هشتگ‌ها را با کاما جدا کن، بدون شماره یا توضیح اضافه.
مثال: #اینستاگرام, #بازاریابی, #دیجیتال_مارکتینگ, #برندینگ`;

  const prompt = `${system}\n\nموضوع: ${topic}\nپلتفرم: ${platform}\nهشتگ‌های موجود: ${existingHashtags || "ندارد"}\n\n۱۰ هشتگ پیشنهادی:`;

  let text = "";

  // Try Gemini first
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
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
        { role: "user", content: `موضوع: ${topic}\nپلتفرم: ${platform}\nهشتگ‌های موجود: ${existingHashtags || "ندارد"}\n\n۱۰ هشتگ پیشنهادی:` },
      ],
      thinking: { type: "disabled" },
      temperature: 0.8,
    });
    text = completion.choices?.[0]?.message?.content ?? "";
  }

  // Parse hashtags from comma/newline separated list
  return text
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/^["'\d.\-\s]+/, ""))
    .filter((s) => s.startsWith("#") && s.length > 1)
    .slice(0, 10);
}

// ── Persian prompt builder ─────────────────────────────────────────────────

function buildCaptionSystem(
  platform: Platform,
  ws?: WorkspaceContext,
  tone?: "formal" | "friendly" | "playful" | "professional",
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
    instagram: "طول: ۱۵۰–۴۰۰ کاراکتر. حداکثر ۳۰ هشتگ در انتها. CTA: نظرت رو کامنت کن.",
    telegram: "طول: تا ۱۰۲۴ کاراکتر. متن خوانا با پاراگراف‌های کوتاه. از ایموجی استفاده کن.",
    linkedin: "طول: ۳۰۰–۸۰۰ کاراکتر. لحن حرفه‌ای. سوال در پایان برای تعامل.",
    rubika: "طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.",
    bale: "طول: تا ۱۰۲۴ کاراکتر. متن خوانا با ایموجی.",
    eitaa: "طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.",
  };

  const toneLabels: Record<string, string> = {
    formal: "رسمی",
    friendly: "صمیمی",
    playful: "شاد و بازیگوش",
    professional: "حرفه‌ای",
  };

  return `تو یک متخصص تولید محتوای فارسی برای شبکه‌های اجتماعی هستی.
کپشن‌هایی که می‌نویسی باید طبیعی، اصیل و کاملاً فارسی باشند — نه ترجمه‌شده از انگلیسی.

قوانین زبانی:
۱. همیشه فارسی معیار. هیچ کلمه لاتین بدون دلیل استفاده نکن.
۲. در پیشوندها و پسوندهای فعلی و جمع‌های یای نکره از نیم‌فاصله استفاده کن: می‌روم، کتاب‌ها، گفت‌وگو.
۳. ارقام فارسی (۰۱۲۳۴۵۶۷۸۹) به‌جای لاتین.
۴. ایموجی‌های رایج ایرانی: ☕️ 🌧 ✨ 🌸 🔥 🤍 😍 🙏. از ایموجی‌های رنگ پوستی پرهیز کن.
۵. هشتگ‌ها با خط زیر و فارسی. حداکثر ۸ هشتگ در انتها.

پلتفرم هدف: ${platformLabels[platform]}
${platformRules[platform]}
${tone ? `لحن: ${toneLabels[tone]}` : ""}
${ws?.brandVoice ? `لحن برند: ${ws.brandVoice}` : ""}
${ws?.contentGuidelines ? `دستورالعمل‌های محتوایی: ${ws.contentGuidelines}` : ""}
${ws?.defaultHashtags ? `هشتگ‌های پایه (حتماً در انتها): ${ws.defaultHashtags}` : ""}
${ws?.captionFooter ? `امضای پایانی: ${ws.captionFooter}` : ""}

ساختار خروجی:
۱. hook یک‌خطی جذاب
۲. بدنه ۲–۴ پاراگراف کوتاه
۳. CTA (دعوت به اقدام)
۴. خط خالی
۵. هشتگ‌ها

فقط کپشن را برگرد — بدون توضیح اضافه، بدون عبارت «این کپشن...».`;
}

// ── Smart reply (for inbox — bonus) ────────────────────────────────────────

/**
 * Generate a smart reply for an inbox message (comment/DM).
 * Tries Gemini first, falls back to z-ai.
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

  const prompt = `${system}\n\nپیام کاربر: ${message}\nپلتفرم: ${platform}\n\nپاسخ:`;

  // Try Gemini first
  if (hasGemini()) {
    try {
      const gemini = getGemini()!;
      const model = gemini.getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim().length > 5) return text;
    } catch (err) {
      console.error("[ai] Gemini reply error, falling back to z-ai:", err);
    }
  }

  // Fallback: z-ai
  const zai = await getZAI();
  const completion = await zai.chat.completions.create({
    model: "glm-4-plus",
    messages: [
      { role: "assistant", content: system },
      { role: "user", content: `پیام کاربر: ${message}\nپلتفرم: ${platform}\n\nپاسخ:` },
    ],
    thinking: { type: "disabled" },
    temperature: 0.7,
  });
  return completion.choices?.[0]?.message?.content ?? "";
}
