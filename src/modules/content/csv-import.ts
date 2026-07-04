import { jalaliToDate, normalizeDigits } from '@/lib/jalali'
import { publicationsService } from '@/modules/publications'
import type { AuthContext } from '@/modules/publications/types'
import { CSV_MAX_ROWS } from './csv-shared'
import type { CsvRow, RowError, ValidatedRow } from './csv-shared'

export { CSV_MAX_ROWS }
export type { CsvRow, RowError, ValidatedRow }

export interface ChannelRef {
  id: string
  name: string
  username: string
  type: string
}

export interface ImportResult {
  created: number
  failed: number
  errors: { row: number; message: string }[]
}

export const CSV_TEMPLATE = `title,caption,channels,scheduled_at,hashtags\r\nعنوان پست نمونه,متن توضیحی پست,نام-کانال,1403/05/15 14:30,#هشتگ\r\n`

export function parseDateString(value: string): Date | null {
  if (!value) return null
  const n = normalizeDigits(value.trim())
  // ISO: YYYY-MM-DD HH:mm or YYYY-MM-DDTHH:mm
  const iso = n.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (iso) {
    const d = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T${iso[4]}:${iso[5]}:00`)
    return isNaN(d.getTime()) ? null : d
  }
  // Jalali: YYYY/MM/DD HH:mm (time optional)
  const jal = n.match(/^(\d{4})\/(\d{2})\/(\d{2})(?:[T ](\d{2}):(\d{2}))?/)
  if (jal) {
    const base = jalaliToDate(Number(jal[1]), Number(jal[2]), Number(jal[3]))
    base.setHours(Number(jal[4] ?? '0'), Number(jal[5] ?? '0'), 0, 0)
    return isNaN(base.getTime()) ? null : base
  }
  return null
}

export function validateRows(rows: CsvRow[], channels: ChannelRef[]): ValidatedRow[] {
  const channelMap = new Map<string, string>()
  for (const ch of channels) {
    channelMap.set(ch.name.toLowerCase(), ch.id)
    if (ch.username) channelMap.set(ch.username.toLowerCase(), ch.id)
    channelMap.set(ch.type.toLowerCase(), ch.id)
    channelMap.set(ch.id, ch.id)
  }

  return rows.map((row, i) => {
    const rowNum = i + 2
    const errors: RowError[] = []
    const channelIds: string[] = []

    if (!row.title) {
      errors.push({ row: rowNum, field: 'title', message: 'عنوان الزامی است' })
    } else if (row.title.length > 200) {
      errors.push({ row: rowNum, field: 'title', message: 'عنوان حداکثر ۲۰۰ کاراکتر' })
    }

    if (!row.channels) {
      errors.push({ row: rowNum, field: 'channels', message: 'حداقل یک کانال الزامی است' })
    } else {
      for (const name of row.channels.split(';').map(n => n.trim()).filter(Boolean)) {
        const id = channelMap.get(name.toLowerCase())
        if (id) channelIds.push(id)
        else errors.push({ row: rowNum, field: 'channels', message: `کانال "${name}" یافت نشد` })
      }
    }

    let scheduledAtIso: string | null = null
    if (row.scheduledAt) {
      const date = parseDateString(row.scheduledAt)
      if (!date) {
        errors.push({ row: rowNum, field: 'scheduled_at', message: 'فرمت تاریخ نامعتبر است (مثال: ۱۴۰۳/۰۵/۱۵ ۱۴:۳۰)' })
      } else if (date.getTime() < Date.now()) {
        errors.push({ row: rowNum, field: 'scheduled_at', message: 'تاریخ نباید در گذشته باشد' })
      } else {
        scheduledAtIso = date.toISOString()
      }
    }

    return { row: rowNum, data: row, channelIds, scheduledAtIso, errors, valid: errors.length === 0 }
  })
}

export async function bulkCreate(auth: AuthContext, validated: ValidatedRow[]): Promise<ImportResult> {
  const valid = validated.filter(r => r.valid)
  let created = 0
  const errors: { row: number; message: string }[] = []

  for (const row of valid) {
    try {
      await publicationsService.create(auth, {
        title: row.data.title,
        caption: row.data.caption || undefined,
        hashtags: row.data.hashtags || undefined,
        channelIds: row.channelIds,
        scheduleMode: row.scheduledAtIso ? 'schedule' : 'now',
        scheduledAt: row.scheduledAtIso ?? null,
        mode: row.scheduledAtIso ? 'publish' : 'draft',
      })
      created++
    } catch (err) {
      errors.push({ row: row.row, message: err instanceof Error ? err.message : 'خطای داخلی' })
    }
  }

  return { created, failed: errors.length, errors }
}
