/**
 * z-ai-web-dev-sdk singleton + Persian AI helpers.
 *
 * Per R3 research: the SDK reads config from /etc/.z-ai-config (already present
 * in this sandbox). We use the singleton pattern to avoid re-initializing on
 * every request.
 *
 * IMPORTANT: z-ai-web-dev-sdk MUST be used in backend code only.
 */

import ZAI from 'z-ai-web-dev-sdk'

let _zai: ZAI | null = null

export async function getZAI(): Promise<ZAI> {
  if (!_zai) {
    _zai = await ZAI.create()
  }
  return _zai
}

export type Platform = 'instagram' | 'telegram' | 'linkedin' | 'rubika' | 'bale' | 'eitaa'

export interface WorkspaceContext {
  name?: string
  brandVoice?: string
  contentGuidelines?: string
  defaultHashtags?: string
  captionFooter?: string
  persianDigits?: boolean
}

/**
 * Persian caption generation via z-ai-web-dev-sdk.
 * Non-streaming version — returns the full caption.
 */
export async function generateCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: 'formal' | 'friendly' | 'playful' | 'professional'
): Promise<string> {
  const zai = await getZAI()
  const system = buildCaptionSystem(platform, workspace, tone)

  const completion = await zai.chat.completions.create({
    model: 'glm-4-plus',
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: `موضوع: ${topic}\n\nکپشن را بنویس.` },
    ],
    thinking: { type: 'disabled' },
    temperature: 0.75,
  })

  return completion.choices?.[0]?.message?.content ?? ''
}

/**
 * Streaming caption generation via z-ai-web-dev-sdk.
 * Yields text chunks as they arrive (SSE-style).
 */
export async function* streamCaption(
  topic: string,
  platform: Platform,
  workspace?: WorkspaceContext,
  tone?: 'formal' | 'friendly' | 'playful' | 'professional'
): AsyncGenerator<string, void, unknown> {
  const zai = await getZAI()
  const system = buildCaptionSystem(platform, workspace, tone)

  const completion = await zai.chat.completions.create({
    model: 'glm-4-plus',
    messages: [
      { role: 'assistant', content: system },
      { role: 'user', content: `موضوع: ${topic}\n\nکپشن را بنویس.` },
    ],
    thinking: { type: 'disabled' },
    temperature: 0.75,
    stream: true,
  })

  // The SDK returns a ReadableStream when stream:true
  // Parse SSE frames: "data: {json}\n\n"
  const reader = (completion as any).getReader?.()
  if (reader) {
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6).trim()
          if (jsonStr === '[DONE]') return
          try {
            const json = JSON.parse(jsonStr)
            const delta = json.choices?.[0]?.delta?.content
            if (delta) yield delta as string
          } catch {
            // Skip malformed JSON
          }
        }
      }
    }
  } else {
    // Fallback: if stream isn't supported, return the full response
    const text = await generateCaption(topic, platform, workspace, tone)
    yield text
  }
}

/**
 * Hashtag suggestion via z-ai-web-dev-sdk.
 * Returns an array of Persian + English hashtags.
 */
export async function suggestHashtags(
  topic: string,
  platform: Platform,
  existingHashtags?: string
): Promise<string[]> {
  const zai = await getZAI()

  const completion = await zai.chat.completions.create({
    model: 'glm-4-plus',
    messages: [
      {
        role: 'assistant',
        content: `تو یک متخصص هشتگ‌های شبکه‌های اجتماعی برای مخاطبان ایرانی هستی.
برای موضوع داده شده، ۱۰ هشتگ مرتبط پیشنهاد بده — ترکیبی از فارسی و انگلیسی.
هشتگ‌های ترند ایرانی و مرتبط با موضوع را انتخاب کن.
فقط هشتگ‌ها را با کاما جدا کن، بدون شماره یا توضیح اضافه.
مثال: #اینستاگرام, #بازاریابی, #دیجیتال_مارکتینگ, #برندینگ`,
      },
      {
        role: 'user',
        content: `موضوع: ${topic}\nپلتفرم: ${platform}\nهشتگ‌های موجود: ${existingHashtags || 'ندارد'}\n\n۱۰ هشتگ پیشنهادی:`,
      },
    ],
    thinking: { type: 'disabled' },
    temperature: 0.8,
  })

  const text = completion.choices?.[0]?.message?.content ?? ''
  // Parse hashtags from comma-separated list
  return text
    .split(/[,\n]/)
    .map((s: string) => s.trim().replace(/^["'\d.\-\s]+/, ''))
    .filter((s: string) => s.startsWith('#') && s.length > 1)
    .slice(0, 10)
}

/**
 * Build the Persian system prompt for caption generation.
 * Incorporates brand voice, guidelines, and platform-specific rules.
 */
function buildCaptionSystem(
  platform: Platform,
  ws?: WorkspaceContext,
  tone?: 'formal' | 'friendly' | 'playful' | 'professional'
): string {
  const platformLabels: Record<Platform, string> = {
    instagram: 'اینستاگرام (پست فید)',
    telegram: 'تلگرام (کانال)',
    linkedin: 'لینکدین (پست)',
    rubika: 'روبیکا (کانال)',
    bale: 'بله (کانال)',
    eitaa: 'ایتا (کانال)',
  }

  const platformRules: Record<Platform, string> = {
    instagram: 'طول: ۱۵۰–۴۰۰ کاراکتر. حداکثر ۳۰ هشتگ در انتها. CTA: نظرت رو کامنت کن.',
    telegram: 'طول: تا ۱۰۲۴ کاراکتر. متن خوانا با پاراگراف‌های کوتاه. از ایموجی استفاده کن.',
    linkedin: 'طول: ۳۰۰–۸۰۰ کاراکتر. لحن حرفه‌ای. سوال در پایان برای تعامل.',
    rubika: 'طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.',
    bale: 'طول: تا ۱۰۲۴ کاراکتر. متن خوانا با ایموجی.',
    eitaa: 'طول: تا ۱۰۲۴ کاراکتر. متن ساده و مستقیم.',
  }

  const toneLabels: Record<string, string> = {
    formal: 'رسمی',
    friendly: 'صمیمی',
    playful: 'شاد و بازیگوش',
    professional: 'حرفه‌ای',
  }

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
${tone ? `لحن: ${toneLabels[tone]}` : ''}
${ws?.brandVoice ? `لحن برند: ${ws.brandVoice}` : ''}
${ws?.contentGuidelines ? `دستورالعمل‌های محتوایی: ${ws.contentGuidelines}` : ''}
${ws?.defaultHashtags ? `هشتگ‌های پایه (حتماً در انتها): ${ws.defaultHashtags}` : ''}
${ws?.captionFooter ? `امضای پایانی: ${ws.captionFooter}` : ''}

ساختار خروجی:
۱. hook یک‌خطی جذاب
۲. بدنه ۲–۴ پاراگراف کوتاه
۳. CTA (دعوت به اقدام)
۴. خط خالی
۵. هشتگ‌ها

فقط کپشن را برگرد — بدون توضیح اضافه، بدون عبارت «این کپشن...».`
}
