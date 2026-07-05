import { describe, it, expect } from 'vitest'
import {
  normalizePersian,
  parseKeywordList,
  matchComment,
  renderDmTemplate,
} from '../../../mini-services/publish-worker/lib/persian-match'

/**
 * The worker ships its own copy of the Persian matching utilities (it cannot
 * import from src/). These tests verify the worker copy behaves identically to
 * the canonical src/modules/automation/comment-dm-shared.ts implementation.
 */

describe('worker/persian-match: normalizePersian', () => {
  it('unifies Arabic and Persian letter variants', () => {
    expect(normalizePersian('قيمت')).toBe(normalizePersian('قیمت'))
    expect(normalizePersian('كاتالوگ')).toBe(normalizePersian('کاتالوگ'))
  })

  it('normalizes Persian and Arabic-Indic digits to ASCII', () => {
    expect(normalizePersian('عدد ۵')).toBe('عدد 5')
    expect(normalizePersian('٩')).toBe('9')
  })

  it('collapses ZWNJ and strips punctuation', () => {
    expect(normalizePersian('ثبت‌نام')).toBe('ثبت نام')
    expect(normalizePersian('قیمت؟!')).toBe('قیمت')
  })

  it('returns empty string for blank input', () => {
    expect(normalizePersian('')).toBe('')
    expect(normalizePersian(null as unknown as string)).toBe('')
  })
})

describe('worker/persian-match: parseKeywordList', () => {
  it('splits on commas, Persian commas, newlines, and pipes', () => {
    expect(parseKeywordList('قیمت، خرید, لینک')).toEqual(['قیمت', 'خرید', 'لینک'])
    expect(parseKeywordList('قیمت\n\nخرید')).toEqual(['قیمت', 'خرید'])
    expect(parseKeywordList('قیمت|خرید')).toEqual(['قیمت', 'خرید'])
  })

  it('keeps multi-word phrases as a single keyword', () => {
    expect(parseKeywordList('قیمت محصول')).toEqual(['قیمت محصول'])
    expect(parseKeywordList('قیمت محصول، لینک بده')).toEqual(['قیمت محصول', 'لینک بده'])
  })

  it('drops empty entries', () => {
    expect(parseKeywordList('  ,، \n')).toEqual([])
    expect(parseKeywordList('')).toEqual([])
  })
})

describe('worker/persian-match: matchComment', () => {
  it('matches a single keyword in a comment', () => {
    const result = matchComment('سلام قیمت چنده؟', ['قیمت'], [])
    expect(result.matched).toBe(true)
    expect(result.reason).toBe('match')
    expect(result.hit).toBe('قیمت')
  })

  it('matches multi-word keyword phrases', () => {
    const result = matchComment('قیمت محصول رو بگید', ['قیمت محصول'], [])
    expect(result.matched).toBe(true)
    expect(result.hit).toBe('قیمت محصول')
  })

  it('exclude keywords suppress the match', () => {
    const result = matchComment('قیمت گران', ['قیمت'], ['گران'])
    expect(result.matched).toBe(false)
    expect(result.reason).toBe('excluded')
    expect(result.hit).toBe('گران')
  })

  it('returns no_match when no keyword is present', () => {
    const result = matchComment('سلام خوبی؟', ['قیمت'], [])
    expect(result.matched).toBe(false)
    expect(result.reason).toBe('no_match')
    expect(result.hit).toBeNull()
  })

  it('normalizes Arabic/Persian variants before matching', () => {
    // Arabic ي/kaf variants should still match Persian keywords.
    expect(matchComment('قيمت چنده', ['قیمت'], []).matched).toBe(true)
    expect(matchComment('كاتالوگ', ['کاتالوگ'], []).matched).toBe(true)
  })
})

describe('worker/persian-match: renderDmTemplate', () => {
  it('interpolates the {نام} variable', () => {
    expect(renderDmTemplate('سلام {نام} عزیز', 'آرش')).toBe('سلام آرش عزیز')
  })

  it('replaces all occurrences of {نام}', () => {
    expect(renderDmTemplate('{نام}، خوش آمدی {نام}', 'سارا')).toBe('سارا، خوش آمدی سارا')
  })

  it('falls back to «کاربر» when sender name is empty', () => {
    expect(renderDmTemplate('سلام {نام}', '')).toBe('سلام کاربر')
  })
})
