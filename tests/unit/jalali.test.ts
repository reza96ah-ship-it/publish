import { describe, it, expect } from 'vitest'
import {
  toJalali,
  toPersianDigits,
  jalaliToDate,
  formatJalali,
  normalizeDigits,
  isHoliday,
  getUpcomingHolidays,
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

describe('jalali — holidays (issue #222)', () => {
  it('fixed solar holiday resolves in any year', () => {
    expect(isHoliday({ year: 1404, month: 11, day: 22, weekday: 0 })).toBe(
      'پیروزی انقلاب اسلامی'
    )
    expect(isHoliday({ year: 1406, month: 12, day: 29, weekday: 0 })).toBe('ملی شدن صنعت نفت')
  })

  it('lunar holiday resolves only in its own year', () => {
    // Ashura 1405 = 4 Tir
    expect(isHoliday({ year: 1405, month: 4, day: 4, weekday: 0 })).toBe('عاشورای حسینی')
    // Same Jalali date in another year is not a holiday
    expect(isHoliday({ year: 1404, month: 4, day: 4, weekday: 0 })).toBeNull()
  })

  it('coinciding fixed + lunar holidays are joined', () => {
    // 1 Farvardin 1405: Nowruz + Eid al-Fitr
    expect(isHoliday({ year: 1405, month: 1, day: 1, weekday: 0 })).toBe('نوروز و عید سعید فطر')
    // 14 Khordad 1405: Imam Khomeini + Eid Ghadir
    expect(isHoliday({ year: 1405, month: 3, day: 14, weekday: 0 })).toBe(
      'رحلت امام خمینی و عید سعید غدیر خم'
    )
  })

  it('bogus legacy entries are gone', () => {
    expect(isHoliday({ year: 1405, month: 7, day: 28, weekday: 0 })).toBeNull()
    expect(isHoliday({ year: 1405, month: 9, day: 30, weekday: 0 })).toBeNull()
  })

  it('getUpcomingHolidays finds holidays with real day distance', () => {
    // 1 Mordad 1405 = 23 Jul 2026; Arbaeen (13 Mordad 1405) is 12 days away
    const from = jalaliToDate(1405, 5, 1)
    const upcoming = getUpcomingHolidays(from, 14)
    const arbaeen = upcoming.find((h) => h.name.includes('اربعین'))
    expect(arbaeen).toBeDefined()
    expect(arbaeen!.daysAway).toBe(12)
    expect(arbaeen!.jalali).toMatchObject({ year: 1405, month: 5, day: 13 })
  })

  it('getUpcomingHolidays excludes today and past days', () => {
    // From Ashura itself (4 Tir 1405): the day itself is not "upcoming"
    const upcoming = getUpcomingHolidays(jalaliToDate(1405, 4, 4), 14)
    expect(upcoming.some((h) => h.jalali.day === 4 && h.jalali.month === 4)).toBe(false)
  })
})
