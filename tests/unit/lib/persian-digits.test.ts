import { describe, it, expect } from 'vitest'
import {
  toPersianDigits,
  normalizeDigits,
  formatNumber,
  formatCompact,
} from '../../../src/lib/jalali'

describe('God-node: toPersianDigits()', () => {
  it('converts single digit', () => {
    expect(toPersianDigits(0)).toBe('۰')
    expect(toPersianDigits(1)).toBe('۱')
    expect(toPersianDigits(9)).toBe('۹')
  })

  it('converts multi-digit number', () => {
    expect(toPersianDigits(123)).toBe('۱۲۳')
    expect(toPersianDigits(999999)).toBe('۹۹۹۹۹۹')
  })

  it('converts string with digits', () => {
    expect(toPersianDigits('abc123')).toBe('abc۱۲۳')
    expect(toPersianDigits('user-42')).toBe('user-۴۲')
  })

  it('converts zero', () => {
    expect(toPersianDigits(0)).toBe('۰')
    expect(toPersianDigits('0')).toBe('۰')
  })

  it('converts large numbers', () => {
    expect(toPersianDigits(1000000)).toBe('۱۰۰۰۰۰۰')
    expect(toPersianDigits(9999999999)).toBe('۹۹۹۹۹۹۹۹۹۹')
  })

  it('preserves non-digit characters', () => {
    expect(toPersianDigits('hello')).toBe('hello')
    expect(toPersianDigits('')).toBe('')
    expect(toPersianDigits('!@#$%')).toBe('!@#$%')
  })

  it('handles mixed content (Persian + digits)', () => {
    expect(toPersianDigits('فصل 3 قسمت 22')).toBe('فصل ۳ قسمت ۲۲')
  })

  it('handles decimal numbers in strings', () => {
    expect(toPersianDigits('3.14')).toBe('۳.۱۴')
  })

  it('handles negative numbers', () => {
    expect(toPersianDigits('-42')).toBe('-۴۲')
  })
})

describe('God-node: normalizeDigits()', () => {
  it('converts Persian digits to ASCII', () => {
    expect(normalizeDigits('۱۲۳')).toBe('123')
  })

  it('converts Arabic-Indic digits to ASCII', () => {
    expect(normalizeDigits('١٢٣')).toBe('123')
  })

  it('converts mixed Persian + Arabic + ASCII', () => {
    expect(normalizeDigits('a1۲٣b')).toBe('a123b')
  })

  it('preserves non-digit characters', () => {
    expect(normalizeDigits('hello')).toBe('hello')
  })
})

describe('God-node: formatNumber()', () => {
  it('formats with thousands separator + Persian digits', () => {
    const result = formatNumber(1234)
    expect(result).toContain('۱')
    expect(result).toContain('۲')
    expect(result).toContain('۳')
    expect(result).toContain('۴')
  })

  it('formats small numbers without separator', () => {
    expect(formatNumber(42)).toBe('۴۲')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('۰')
  })
})

describe('God-node: formatCompact()', () => {
  it('formats millions with M suffix', () => {
    expect(formatCompact(1_500_000)).toBe('۱.۵M')
  })

  it('formats thousands with K suffix', () => {
    expect(formatCompact(2_500)).toBe('۲.۵K')
  })

  it('formats small numbers as-is', () => {
    expect(formatCompact(42)).toBe('۴۲')
  })

  it('formats zero', () => {
    expect(formatCompact(0)).toBe('۰')
  })
})
