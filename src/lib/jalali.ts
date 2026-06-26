// Jalali (Solar Hijri) calendar utilities — Persian-first, the moat.
// Algorithm: astronomy-based conversion well-known in the Persian dev community.

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
] as const

export const JALALI_WEEKDAYS = [
  'شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه',
] as const

export const JALALI_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const

// Iranian official holidays (approximate, common observances) — month/day in Jalali
export const IRAN_HOLIDAYS: Record<string, string> = {
  '1-1': 'نوروز',
  '1-2': 'نوروز',
  '1-3': 'نوروز',
  '1-4': 'نوروز',
  '1-12': 'روز جمهوری اسلامی',
  '1-13': 'سیزده‌بدر',
  '3-14': 'رحلت امام خمینی',
  '3-15': 'قیام ۱۵ خرداد',
  '7-28': 'انقلاب اسلامی',
  '9-30': 'پیروزی انقلاب',
  '12-29': 'ملی شدن صنعت نفت',
}

function div(a: number, b: number) { return Math.floor(a / b) }
function mod(a: number, b: number) { return a - Math.floor(a / b) * b }

function jalaliToGregorianHelper(jy: number, jm: number, jd: number): [number, number, number] {
  const sal_a = jy <= 979 ? 0 : -1595
  const gy_a = jy <= 979 ? 621 + jy : 1600 + jy - 979
  const days_a = jy <= 979 ? 365 * jy + div(8 + jy, 33) * 8 + div(mod(8 + jy, 33) + 3, 4) + sal_a : 365 * (jy - 979) + div(jy, 33) * 8 + div(mod(jy, 33) + 3, 4) + 1081
  let days_b = days_a + 179 + (jm <= 7 ? (jm - 1) * 31 : (jm - 1) * 30 + 186) + jd

  let gy = gy_a + 400 * div(days_b, 146097)
  days_b = mod(days_b, 146097)

  let leap = true
  if (days_b >= 36525) {
    days_b -= 1
    gy += 100 * div(days_b, 36524)
    days_b = mod(days_b, 36524)
    if (days_b < 365) leap = false
    days_b += 1
  }

  let n = 0
  if (leap) {
    gy += 4 * div(days_b, 1461)
    days_b = mod(days_b, 1461)
    if (days_b > 365) {
      days_b -= 1
      n = div(days_b, 365)
      gy += n
      days_b = mod(days_b, 365)
      n += 1
    }
  } else {
    n = div(days_b, 365)
    gy += n
    days_b = mod(days_b, 365)
    n += 1
  }

  const sal_b = -1
  const v = 0
  const md = [31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0
  let gd = 0
  for (let i = 0; i < md.length; i++) {
    if (days_b + 1 <= md[i]) {
      gm = i + 1
      gd = days_b + 1
      break
    }
    days_b -= md[i]
  }
  return [gy, gm, gd]
}

function gregorianToJalaliHelper(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  const gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + 33 * div(days, 12053)
  days = mod(days, 12053)
  jy += 4 * div(days, 1461)
  days = mod(days, 1461)
  if (days > 365) {
    jy += div(days - 1, 365)
    days = mod(days - 1, 365)
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30)
  const jd = 1 + (days < 186 ? mod(days, 31) : mod(days - 186, 30))
  return [jy, jm, jd]
}

export interface JalaliDate {
  year: number
  month: number // 1-12
  day: number // 1-31
  monthName: string
  weekday: number // 0=شنبه ... 6=جمعه
  weekdayName: string
}

export function toJalali(date: Date): JalaliDate {
  const [jy, jm, jd] = gregorianToJalaliHelper(date.getFullYear(), date.getMonth() + 1, date.getDate())
  // weekday: JS getDay() returns 0=Sunday..6=Saturday; convert to 0=Saturday..6=Friday
  const jsDay = date.getDay()
  const weekday = (jsDay + 1) % 7 // Sat=0, Sun=1, ..., Fri=6
  return {
    year: jy,
    month: jm,
    day: jd,
    monthName: JALALI_MONTHS[jm - 1],
    weekday,
    weekdayName: JALALI_WEEKDAYS[weekday],
  }
}

export function jalaliToDate(jy: number, jm: number, jd: number): Date {
  // Find the Gregorian date of Persian new year (1/1) of year jy.
  // Persian new year falls on March 19, 20, 21, or 22 of Gregorian year (jy + 621).
  // We rely on the (correct) toJalali implementation to anchor the year, then add
  // (jm-1) months + (jd-1) days of Persian-calendar offsets. Persian months 1-6
  // have 31 days, 7-11 have 30 days, 12 has 29 or 30 (we don't need to know Esfand's
  // length unless jm === 13, which is invalid).
  const date = new Date(jy + 621, 2, 20); // March 20 of (jy + 621) — around Persian new year

  // Move forward until toJalali(date).year === jy (handles leap-year drift)
  let guard = 0;
  while (toJalali(date).year < jy && guard < 10) {
    date.setDate(date.getDate() + 1);
    guard++;
  }
  guard = 0;
  while (toJalali(date).year > jy && guard < 10) {
    date.setDate(date.getDate() - 1);
    guard++;
  }
  // Now `date` is Persian 1/1 of year jy.

  // Add (jm - 1) Persian months + (jd - 1) days.
  // Months 1-6 = 31 days, 7-11 = 30 days. (We don't touch month 12's length here.)
  const daysFromStart = jm <= 6
    ? 31 * (jm - 1) + (jd - 1)
    : 31 * 6 + 30 * (jm - 7) + (jd - 1);

  date.setDate(date.getDate() + daysFromStart);
  return date;
}

export function formatJalali(date: Date, withWeekday = false): string {
  const j = toJalali(date)
  const base = `${j.year}/${String(j.month).padStart(2, '0')}/${String(j.day).padStart(2, '0')}`
  return withWeekday ? `${j.weekdayName} ${j.day} ${j.monthName} ${j.year}` : base
}

export function formatJalaliShort(date: Date): string {
  const j = toJalali(date)
  return `${j.day} ${j.monthName}`
}

export function formatJalaliTime(date: Date): string {
  const h = date.getHours()
  const m = date.getMinutes()
  const period = h < 12 ? 'صبح' : 'بعدازظهر'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${String(m).padStart(2, '0')} ${period}`
}

export function relativeTime(date: Date): string {
  const diff = Date.now() - date.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'هم‌اکنون'
  if (min < 60) return `${toPersianDigits(min)} دقیقه پیش`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${toPersianDigits(hr)} ساعت پیش`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${toPersianDigits(day)} روز پیش`
  return formatJalaliShort(date)
}

export function isHoliday(jalali: JalaliDate): string | null {
  return IRAN_HOLIDAYS[`${jalali.month}-${jalali.day}`] ?? null
}

// Persian digit conversion
const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹']
const PERSIAN_DIGIT_REGEX = /[0-9]/g

export function toPersianDigits(input: string | number): string {
  return String(input).replace(PERSIAN_DIGIT_REGEX, (d) => PERSIAN_DIGITS[Number(d)])
}

// Normalize Persian/Arabic-Indic digits to ASCII (for matching/automation)
export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

// Format a number with thousands separator + Persian digits
export function formatNumber(n: number): string {
  return toPersianDigits(n.toLocaleString('en-US'))
}

// Compact number (e.g., 142.5K)
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return toPersianDigits((n / 1_000_000).toFixed(1)) + 'M'
  if (n >= 1_000) return toPersianDigits((n / 1_000).toFixed(1)) + 'K'
  return toPersianDigits(n)
}

// Jalali month grid for calendar view — returns 6 weeks × 7 days, Sat-first
export interface CalendarCell {
  date: Date
  jalali: JalaliDate
  inMonth: boolean
  isToday: boolean
  holiday: string | null
  isWeekend: boolean // Thursday(5) or Friday(6)
}

export function getJalaliMonthGrid(year: number, month: number): CalendarCell[] {
  const firstGreg = jalaliToDate(year, month, 1)
  const firstWeekday = (firstGreg.getDay() + 1) % 7 // 0=Sat
  // days in jalali month
  const daysInMonth =
    month <= 6 ? 31 : month <= 11 ? 30 : // Esfand: 29 or 30
    (jalaliToDate(year + 1, 1, 1).getTime() - firstGreg.getTime()) / 86400_000

  const cells: CalendarCell[] = []
  const today = new Date()
  const todayJ = toJalali(today)

  // leading days from previous month
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  const prevFirst = jalaliToDate(prevYear, prevMonth, 1)
  const daysInPrev = prevMonth <= 6 ? 31 : prevMonth <= 11 ? 30 : (prevFirst.getTime() - jalaliToDate(prevYear - 1, prevMonth, 1).getTime()) / 86400_000

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = new Date(prevFirst)
    d.setDate(d.getDate() + (daysInPrev - 1 - i))
    const j = toJalali(d)
    cells.push({ date: d, jalali: j, inMonth: false, isToday: false, holiday: isHoliday(j), isWeekend: j.weekday >= 5 })
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = jalaliToDate(year, month, day)
    const j = toJalali(d)
    const isToday = j.year === todayJ.year && j.month === todayJ.month && j.day === todayJ.day
    cells.push({ date: d, jalali: j, inMonth: true, isToday, holiday: isHoliday(j), isWeekend: j.weekday >= 5 })
  }

  // trailing days to fill 42 cells
  const nextMonth = month === 12 ? 1 : month + 1
  const nextYear = month === 12 ? year + 1 : year
  let nextDay = 1
  while (cells.length < 42) {
    const d = jalaliToDate(nextYear, nextMonth, nextDay)
    const j = toJalali(d)
    cells.push({ date: d, jalali: j, inMonth: false, isToday: false, holiday: isHoliday(j), isWeekend: j.weekday >= 5 })
    nextDay++
  }

  return cells
}
