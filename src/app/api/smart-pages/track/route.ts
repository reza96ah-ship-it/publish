/**
 * Issue #250: Smart Pages API — public click tracking beacon.
 *
 *   POST /api/smart-pages/track
 *
 * Called by the public /p/[slug] page when a visitor clicks a link block.
 * NO AUTH — this is a public endpoint. Body shape:
 *   { slug, blockId, blockType, label, url, referrer?, userAgent? }
 *
 * Records a SmartPageClick row + increments the page's clicks counter.
 * Always returns 200 `{ ok: true }` for valid slugs (even if recording has
 * issues, we don't want to break the visitor's outbound navigation).
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateBody, smartPageClickSchema } from '@/lib/validations'
import { smartPagesService, SmartPageError } from '@/modules/smart-pages'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }

  const validation = validateBody(smartPageClickSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const { slug, ...clickInput } = validation.data

  try {
    await smartPagesService.recordClick(slug, {
      blockId: clickInput.blockId,
      blockType: clickInput.blockType,
      label: clickInput.label,
      url: clickInput.url,
      referrer: clickInput.referrer ?? undefined,
      userAgent: clickInput.userAgent ?? undefined,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    // 404 if the slug doesn't resolve — useful so the caller can stop retrying.
    if (err instanceof SmartPageError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}
