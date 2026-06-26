import { describe, it, expect } from 'vitest'
import {
  toJalali,
  toPersianDigits,
  jalaliToDate,
  formatJalali,
  normalizeDigits,
} from '@/lib/jalali'

describe('jalali — gregorian→jalali conversion', () => {
  it('toJalali(new Date(2024, 0, 1)) returns 1402/10/11 (1 Jan 2024 = 11 Dey 1402)', () => {
    const j = toJalali(new Date(2024, 0, 1))
    expect(j.year).toBe(1402)
    expect(j.month).toBe(10)
    expect(j.day).toBe(11)
  })
})

describe('jalali — persian digits', () => {
  it('toPersianDigits(123) returns "۱۲۳"', () => {
    expect(toPersianDigits(123)).toBe('۱۲۳')
  })

  it('normalizeDigits("۱۲۳٤٥") returns "12345" (Persian ۱۲۳ + Arabic ٤٥)', () => {
    expect(normalizeDigits('۱۲۳٤٥')).toBe('12345')
  })
})

describe('jalali — jalali→gregorian conversion', () => {
  it('jalaliToDate(1402, 10, 11) equals new Date(2024, 0, 1)', () => {
    const d = jalaliToDate(1402, 10, 11)
    const expected = new Date(2024, 0, 1)
    expect(d.getFullYear()).toBe(expected.getFullYear())
    expect(d.getMonth()).toBe(expected.getMonth())
    expect(d.getDate()).toBe(expected.getDate())
  })
})

describe('jalali — formatting', () => {
  it('formatJalali(new Date(2024, 0, 1)) returns "1402/10/11"', () => {
    expect(formatJalali(new Date(2024, 0, 1))).toBe('1402/10/11')
  })
})
