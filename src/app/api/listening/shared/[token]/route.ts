/**
 * Issue #251: Social listening API — PUBLIC shared search.
 *
 *   GET /api/listening/shared/[token]
 *     — NO AUTH — anyone with the share URL can view the query + recent mentions
 *     — intended for stakeholder review links (e.g. shared with a client)
 *
 * Returns the listening query (without workspace internals), up to 50 most
 * recent mentions, and the coverage disclosure summary.
 *
 * Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { listeningService, ListeningError } from '@/modules/listening'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 8 || token.length > 100) {
    return NextResponse.json({ error: 'توکن نامعتبر است' }, { status: 400 })
  }

  try {
    const result = await listeningService.getQueryByShareToken(token)
    if (!result) {
      return NextResponse.json(
        { error: 'جستجوی اشتراکی یافت نشد یا غیرفعال است' },
        { status: 404 }
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof ListeningError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}
