/**
 * Issue #252: AI evaluation harness — 5 seeded Persian prompt sets.
 *
 * Each set targets a different caption tone so a reviewer can spot tone
 * regressions after a prompt change. The prompts are intentionally short
 * and concrete — they're meant to surface tone/length/format issues, not
 * to be the production prompts themselves.
 *
 * Persian copy is written in formal Persian (کتابی) so it's unambiguous.
 */

import type { EvaluationSet, SeedPrompt } from './types'

function makeSet(
  id: string,
  name: string,
  tone: EvaluationSet['tone'],
  prompts: Array<{ prompt: string; platform: 'instagram' | 'telegram' }>
): EvaluationSet {
  return {
    id,
    name,
    tone,
    prompts: prompts.map<SeedPrompt>((p) => ({ ...p, tone })),
    createdAt: new Date().toISOString(),
  }
}

export const SEED_EVALUATION_SETS: EvaluationSet[] = [
  makeSet('seed-formal', 'مجموعه ارزیابی رسمی', 'formal', [
    { prompt: 'معرفی خدمات مشاوره مالیاتی شرکت', platform: 'instagram' },
    { prompt: 'اطلاع‌رسانی تغییرات ساعات کاری دفتر', platform: 'telegram' },
  ]),
  makeSet('seed-friendly', 'مجموعه ارزیابی صمیمی', 'friendly', [
    { prompt: 'تبریک آغاز فصل بهار به دنبال‌کنندگان', platform: 'instagram' },
    { prompt: 'دعوت به اشتراک‌گذاری تجربه کاربری محصول', platform: 'telegram' },
  ]),
  makeSet('seed-promotional', 'مجموعه ارزیابی تبلیغاتی', 'promotional', [
    { prompt: 'تخفیف ویژه آخر هفته برای محصولات منتخب', platform: 'instagram' },
    { prompt: 'معرفی نسخه جدید اپلیکیشن با امکانات بیشتر', platform: 'telegram' },
  ]),
  makeSet('seed-support', 'مجموعه ارزیابی پشتیبانی', 'support', [
    { prompt: 'پاسخ به سوال رایج درباره نحوه بازگشت کالا', platform: 'instagram' },
    { prompt: 'راهنمای گام‌به‌گام بازنشانی رمز عبور حساب', platform: 'telegram' },
  ]),
  makeSet('seed-professional', 'مجموعه ارزیابی حرفه‌ای', 'professional', [
    { prompt: 'خلاصه گزارش تخصصی روند بازار هفته', platform: 'instagram' },
    { prompt: 'دعوت به وبینار تخصصی با کارشناسان صنعت', platform: 'telegram' },
  ]),
]
