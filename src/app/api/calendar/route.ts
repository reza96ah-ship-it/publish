import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET(req: Request) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })

  const { searchParams } = new URL(req.url)
  const year = Number(searchParams.get('year'))
  const month = Number(searchParams.get('month'))

  // window: that Jalali month → approximate gregorian range (start of month ± 5 days buffer)
  const startGreg = jalaliToGreg(year, month, 1)
  const endGreg = month < 12 ? jalaliToGreg(year, month + 1, 1) : jalaliToGreg(year + 1, 1, 1)
  startGreg.setDate(startGreg.getDate() - 5)
  endGreg.setDate(endGreg.getDate() + 5)

  const jobs = await db.publishJob.findMany({
    where: {
      workspaceId,
      scheduledAt: { gte: startGreg, lte: endGreg },
    },
    include: {
      content: { select: { title: true, thumbnailUrl: true } },
      platform: { select: { type: true } },
    },
  })

  return NextResponse.json(jobs.map((j) => ({
    id: j.id,
    title: j.content.title,
    thumbnail: j.content.thumbnailUrl ?? '',
    platform: j.platform.type,
    status: j.status,
    scheduledAt: j.scheduledAt,
    progress: j.progress,
  })))
}

function jalaliToGreg(jy: number, jm: number, jd: number): Date {
  function div(a: number, b: number) { return Math.floor(a / b) }
  function mod(a: number, b: number) { return a - Math.floor(a / b) * b }
  const sal_a = jy <= 979 ? 0 : -1595
  const gy_a = jy <= 979 ? 621 + jy : 1600 + jy - 979
  const days_a = jy <= 979
    ? 365 * jy + div(8 + jy, 33) * 8 + div(mod(8 + jy, 33) + 3, 4) + sal_a
    : 365 * (jy - 979) + div(jy, 33) * 8 + div(mod(jy, 33) + 3, 4) + 1081
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
  const md = [31, (gy % 4 === 0 && (gy % 100 !== 0 || gy % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gm = 0, gd = 0
  for (let i = 0; i < md.length; i++) {
    if (days_b + 1 <= md[i]) { gm = i + 1; gd = days_b + 1; break }
    days_b -= md[i]
  }
  return new Date(gy, gm - 1, gd)
}
