import { describe, it, expect } from 'vitest'
import {
  normalizePersian,
  parseKeywordList,
  matchComment,
  detectCommentKeyword,
  previewTemplate,
} from '../../../src/modules/automation/comment-dm-shared'

describe('normalizePersian', () => {
  it('unifies Arabic and Persian letter variants', () => {
    // Arabic yeh/kaf → Persian yeh/kaf, so both spellings collapse together.
    expect(normalizePersian('قيمت')).toBe(normalizePersian('قیمت'))
    expect(normalizePersian('كاتالوگ')).toBe(normalizePersian('کاتالوگ'))
  })

  it('normalizes Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizePersian('عدد ۵')).toBe('عدد 5')
    expect(normalizePersian('٩')).toBe('9')
  })

  it('collapses ZWNJ (half-space) and strips punctuation', () => {
    expect(normalizePersian('ثبت‌نام')).toBe('ثبت نام')
    expect(normalizePersian('قیمت؟!')).toBe('قیمت')
  })

  it('is case-insensitive for latin text and returns empty for blank input', () => {
    expect(normalizePersian('LINK')).toBe('link')
    expect(normalizePersian('')).toBe('')
  })
})

describe('parseKeywordList', () => {
  it('splits on commas, Persian commas, and newlines and trims', () => {
    expect(parseKeywordList('قیمت، خرید, لینک')).toEqual(['قیمت', 'خرید', 'لینک'])
    expect(parseKeywordList('قیمت\n\nخرید')).toEqual(['قیمت', 'خرید'])
  })

  it('drops empty entries', () => {
    expect(parseKeywordList('  ,، \n')).toEqual([])
  })
})

describe('matchComment', () => {
  it('matches a keyword regardless of Arabic/Persian spelling', () => {
    const r = matchComment('سلام قيمت چنده؟', ['قیمت'])
    expect(r.matched).toBe(true)
    expect(r.reason).toBe('match')
    expect(r.hit).toBe('قیمت')
  })

  it('matches any of several keywords', () => {
    expect(matchComment('لینک رو بده', ['قیمت', 'لینک']).matched).toBe(true)
  })

  it('exclude keywords win over trigger keywords', () => {
    const r = matchComment('قیمت خیلی گرونه', ['قیمت'], ['گرون'])
    expect(r.matched).toBe(false)
    expect(r.reason).toBe('excluded')
    expect(r.hit).toBe('گرون')
  })

  it('returns no_match when nothing matches', () => {
    const r = matchComment('چه پست قشنگی', ['قیمت'])
    expect(r.matched).toBe(false)
    expect(r.reason).toBe('no_match')
    expect(r.hit).toBeNull()
  })

  it('matches numeric keywords across digit scripts', () => {
    expect(matchComment('عدد ۵ رو فرستادم', ['5']).matched).toBe(true)
  })

  it('treats empty comment as no_match', () => {
    expect(matchComment('', ['قیمت']).reason).toBe('no_match')
  })
})

describe('detectCommentKeyword', () => {
  it('detects "کلمه X را کامنت کنید"', () => {
    expect(detectCommentKeyword('برای دریافت کلمه قهوه را کامنت کنید')).toBe('قهوه')
  })

  it('detects a number trigger', () => {
    expect(detectCommentKeyword('عدد ۵ را کامنت کنید')).toBe('۵')
  })

  it('detects "X را کامنت کنید"', () => {
    expect(detectCommentKeyword('قیمت را کامنت کنید')).toBe('قیمت')
  })

  it('returns null when there is no trigger phrase', () => {
    expect(detectCommentKeyword('یک پست معمولی بدون دعوت به کامنت')).toBeNull()
    expect(detectCommentKeyword('')).toBeNull()
  })
})

describe('previewTemplate', () => {
  it('interpolates {نام} with the sender name', () => {
    expect(previewTemplate('سلام {نام} عزیز', 'آرش')).toBe('سلام آرش عزیز')
  })

  it('falls back to کاربر when name is empty', () => {
    expect(previewTemplate('سلام {نام}', '')).toBe('سلام کاربر')
  })
})

describe('multi-word keywords', () => {
  it('matches a multi-word phrase as a single keyword', () => {
    const r = matchComment('سلام قیمت چنده؟', ['قیمت چنده'])
    expect(r.matched).toBe(true)
    expect(r.hit).toBe('قیمت چنده')
  })

  it('matches multi-word phrases separated by commas', () => {
    const keywords = parseKeywordList('قیمت چنده, لینک بده')
    expect(keywords).toEqual(['قیمت چنده', 'لینک بده'])
    expect(matchComment('قیمت چنده؟', keywords).matched).toBe(true)
    expect(matchComment('لینک بده لطفا', keywords).matched).toBe(true)
  })

  it('matches multi-word phrases separated by Persian comma', () => {
    const keywords = parseKeywordList('قیمت چنده، لینک بده')
    expect(keywords).toEqual(['قیمت چنده', 'لینک بده'])
  })

  it('matches multi-word phrases separated by pipe', () => {
    const keywords = parseKeywordList('قیمت چنده | لینک بده')
    expect(keywords).toEqual(['قیمت چنده', 'لینک بده'])
  })

  it('does not split multi-word phrases on spaces', () => {
    const keywords = parseKeywordList('قیمت چنده')
    expect(keywords).toEqual(['قیمت چنده']) // one keyword, not ['قیمت', 'چنده']
  })

  it('normalizes multi-word phrases with ZWNJ', () => {
    const r = matchComment('ثبت‌نام کنم', ['ثبت نام'])
    expect(r.matched).toBe(true)
  })

  it('matches multi-word exclude phrases', () => {
    const r = matchComment('قیمت چنده واقعا', ['قیمت'], ['قیمت چنده'])
    expect(r.matched).toBe(false)
    expect(r.reason).toBe('excluded')
  })
})

describe('normalizePersian edge cases', () => {
  it('handles RLM/LRM marks', () => {
    expect(normalizePersian('قیمت\u200E')).toBe('قیمت')
    expect(normalizePersian('قیمت\u200F')).toBe('قیمت')
  })

  it('handles Persian Presentation Forms ( contextual letter shapes)', () => {
    // Presentation Form Yeh Final \uFEF1 should normalize to ی
    const r = normalizePersian('قا\uFEF1\uFEF2') // presentation form ی
    expect(r).toContain('ی')
  })
})
