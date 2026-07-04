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
