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
  tone?: "formal" | "friendly" | "playful" | "professional",
): Promise<string> {
  const system = buildCaptionSystem(platform, workspace, tone);

  // Try GapGPT first (OpenAI-compatible)
  if (hasGapGPT()) {
    try {
      const text = await gapgptComplete(system, `موضوع: ${topic}\n\nکپشن را بنویس.`, 0.75);
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
  tone?: "formal" | "friendly" | "playful" | "professional",
): AsyncGenerator<string, void, unknown> {
  const system = buildCaptionSystem(platform, workspace, tone);

  // Try GapGPT streaming first
  if (hasGapGPT()) {
    try {
      let yielded = false;
      for await (const chunk of gapgptStream(system, `موضوع: ${topic}\n\nکپشن را بنویس.`, 0.75)) {
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
): Promise<string[]> {
  const system = `تو یک متخصص هشتگ‌های شبکه‌های اجتماعی برای مخاطبان ایرانی هستی.
برای موضوع داده شده، ۱۰ هشتگ مرتبط پیشنهاد بده — ترکیبی از فارسی و انگلیسی.
هشتگ‌های ترند ایرانی و مرتبط با موضوع را انتخاب کن.
فقط هشتگ‌ها را با کاما جدا کن، بدون شماره یا توضیح اضافه.
مثال: #اینستاگرام, #بازاریابی, #دیجیتال_مارکتینگ, #برندینگ`;

  const userMsg = `موضوع: ${topic}\nپلتفرم: ${platform}\nهشتگ‌های موجود: ${existingHashtags || "ندارد"}\n\n۱۰ هشتگ پیشنهادی:`;
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

  return text
    .split(/[,\n]/)
    .map((s) => s.trim().replace(/^["'\d.\-\s]+/, ""))
    .filter((s) => s.startsWith("#") && s.length > 1)
    .slice(0, 10);
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

async function gapgptComplete(system: string, user: string, temperature: number): Promise<string> {
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
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GapGPT ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function* gapgptStream(system: string, user: string, temperature: number): AsyncGenerator<string, void, unknown> {
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
