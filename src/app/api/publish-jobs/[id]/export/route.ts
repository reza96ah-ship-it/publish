/**
 * GET /api/publish-jobs/[id]/export
 *
 * Returns a ZIP file with everything a social media manager needs to
 * publish manually from their phone when Nashrino or Meta is unreachable.
 *
 * ZIP contents:
 *   caption.txt        — full Persian caption, UTF-8
 *   hashtags.txt       — hashtag string
 *   schedule.txt       — Jalali + UTC scheduled time (or "بدون برنامه زمانی")
 *   metadata.json      — structured JSON (job id, platform, content id, …)
 *   media/01_photo.jpg — media assets in publish order (best-effort; skipped if URL unreachable)
 */
import { NextResponse } from 'next/server'
import { zipSync } from 'fflate'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { formatJalali, formatJalaliTime } from '@/lib/jalali'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('job.schedule')
  if (guard.error) return guard.error

  const { id } = await params

  const job = await db.publishJob.findFirst({
    where: { id, workspaceId: guard.workspaceId },
    include: {
      content: {
        include: {
          revisions: {
            orderBy: { version: 'desc' },
            take: 1,
            include: {
              media: {
                orderBy: { position: 'asc' },
              },
            },
          },
        },
      },
      platform: { select: { type: true, name: true } },
      campaign: { select: { name: true } },
    },
  })

  if (!job) {
    return NextResponse.json({ error: 'کار انتشار یافت نشد' }, { status: 404 })
  }

  const content = job.content
  const revision = content?.revisions?.[0] ?? null
  const enc = new TextEncoder()

  // caption.txt
  const caption = revision?.body ?? content?.body ?? ''
  const captionBytes = enc.encode(caption || '(بدون متن)')

  // hashtags.txt
  const hashtags = revision?.hashtags ?? content?.hashtags ?? ''
  const hashtagBytes = enc.encode(hashtags || '(بدون هشتگ)')

  // schedule.txt
  const scheduledAt = job.scheduledAt
  let scheduleText: string
  if (scheduledAt) {
    const jalaliDate = formatJalali(scheduledAt)
    const jalaliTime = formatJalaliTime(scheduledAt)
    const utcIso = scheduledAt.toISOString()
    scheduleText = `جلالی: ${jalaliDate} ساعت ${jalaliTime}\nUTC:   ${utcIso}`
  } else {
    scheduleText = 'بدون برنامه زمانی'
  }
  const scheduleBytes = enc.encode(scheduleText)

  // metadata.json
  const metadata = {
    jobId: job.id,
    contentId: content?.id ?? null,
    platform: job.platform?.type ?? 'unknown',
    platformName: job.platform?.name ?? '',
    campaign: job.campaign?.name ?? null,
    title: content?.title ?? '',
    scheduledAt: scheduledAt?.toISOString() ?? null,
    exportedAt: new Date().toISOString(),
    warning: 'این فایل برای انتشار دستی است — به‌معنای انتشار خودکار به اینستاگرام نیست.',
  }
  const metaBytes = enc.encode(JSON.stringify(metadata, null, 2))

  // media files
  const mediaItems = revision?.media ?? []
  const mediaEntries: Record<string, Uint8Array> = {}
  const skipped: string[] = []

  await Promise.all(
    mediaItems.map(async (item) => {
      const mediaRow = item.mediaId
        ? await db.media.findUnique({ where: { id: item.mediaId } })
        : null
      if (!mediaRow?.url) return

      const ext = extFromType(mediaRow.fileType)
      const filename = `media/${String(item.position + 1).padStart(2, '0')}_${item.role}${ext}`

      try {
        const res = await fetch(mediaRow.url, { signal: AbortSignal.timeout(15_000) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const buf = await res.arrayBuffer()
        mediaEntries[filename] = new Uint8Array(buf)
      } catch {
        skipped.push(mediaRow.url)
      }
    })
  )

  if (skipped.length > 0) {
    const skipNote = enc.encode(
      `فایل‌های زیر قابل دسترس نبودند و در آرشیو گنجانده نشدند:\n${skipped.join('\n')}`
    )
    mediaEntries['media/SKIPPED.txt'] = skipNote
  }

  const zipEntries: Record<string, Uint8Array> = {
    'caption.txt': captionBytes,
    'hashtags.txt': hashtagBytes,
    'schedule.txt': scheduleBytes,
    'metadata.json': metaBytes,
    ...mediaEntries,
  }

  const zipped = zipSync(zipEntries, { level: 1 })

  const safeTitle = (content?.title ?? 'post').replace(/[^a-zA-Z0-9؀-ۿ_-]/g, '_').slice(0, 40)
  const filename = `nashrino-export-${safeTitle}-${job.id.slice(-6)}.zip`

  return new Response(zipped, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Content-Length': String(zipped.byteLength),
    },
  })
}

function extFromType(mimeType: string): string {
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
