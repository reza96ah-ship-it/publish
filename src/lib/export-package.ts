import { zipSync } from 'fflate'
import { db } from '@/lib/db'
import { formatJalali, formatJalaliTime } from '@/lib/jalali'

type ExportJob = Awaited<ReturnType<typeof fetchExportJob>>

export async function fetchExportJob(id: string, workspaceId: string) {
  return db.publishJob.findFirst({
    where: { id, workspaceId },
    include: {
      content: {
        include: {
          revisions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: { media: { orderBy: { position: 'asc' } } },
          },
        },
      },
      platform: { select: { type: true, name: true } },
      campaign: { select: { name: true } },
    },
  })
}

export async function buildExportZip(job: NonNullable<ExportJob>) {
  const enc = new TextEncoder()
  const content = job.content
  const revision = content?.revisions?.[0] ?? null

  const caption = revision?.body ?? content?.body ?? ''
  const hashtags = revision?.hashtags ?? content?.hashtags ?? ''

  let scheduleText: string
  if (job.scheduledAt) {
    const d = job.scheduledAt
    scheduleText = `جلالی: ${formatJalali(d)} ساعت ${formatJalaliTime(d)}\nUTC:   ${d.toISOString()}`
  } else {
    scheduleText = 'بدون برنامه زمانی'
  }

  const metadata = {
    jobId: job.id,
    contentId: content?.id ?? null,
    platform: job.platform?.type ?? 'unknown',
    platformName: job.platform?.name ?? '',
    campaign: job.campaign?.name ?? null,
    title: content?.title ?? '',
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    exportedAt: new Date().toISOString(),
    warning: 'این فایل برای انتشار دستی است — به‌معنای انتشار خودکار به اینستاگرام نیست.',
  }

  const mediaEntries: Record<string, Uint8Array> = {}
  const skipped: string[] = []

  await Promise.all(
    (revision?.media ?? []).map(async (item) => {
      const mediaRow = await db.media.findUnique({ where: { id: item.mediaId } })
      if (!mediaRow?.url) return
      const ext = extFromMime(mediaRow.fileType)
      const name = `media/${String(item.position + 1).padStart(2, '0')}_${item.role}${ext}`
      try {
        const res = await fetch(mediaRow.url, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        mediaEntries[name] = new Uint8Array(await res.arrayBuffer())
      } catch {
        skipped.push(mediaRow.url)
      }
    })
  )

  if (skipped.length > 0) {
    mediaEntries['media/SKIPPED.txt'] = enc.encode(
      `فایل‌های زیر قابل دسترس نبودند:\n${skipped.join('\n')}`
    )
  }

  const zipped = zipSync(
    {
      'caption.txt': enc.encode(caption || '(بدون متن)'),
      'hashtags.txt': enc.encode(hashtags || '(بدون هشتگ)'),
      'schedule.txt': enc.encode(scheduleText),
      'metadata.json': enc.encode(JSON.stringify(metadata, null, 2)),
      ...mediaEntries,
    },
    { level: 1 }
  )

  const safeTitle = (content?.title ?? 'post').replace(/[^a-zA-Z0-9؀-ۿ_-]/g, '_').slice(0, 40)
  const filename = `nashrino-export-${safeTitle}-${job.id.slice(-6)}.zip`

  return { zipped, filename }
}

function extFromMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
  }
  return map[mimeType] ?? ''
}
