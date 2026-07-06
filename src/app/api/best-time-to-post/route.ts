/**
 * GET /api/best-time-to-post?platform=instagram — best-time suggestions.
 * Issue #204: Persian-market aware best-time-to-post.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getBestTimesToPost, formatBestTime } from '@/modules/scheduling/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const platform = req.nextUrl.searchParams.get('platform')
  if (!platform) return NextResponse.json({ error: 'پارامتر platform الزامی است' }, { status: 400 })
  const suggestions = await getBestTimesToPost(guard.workspaceId, platform)
  return NextResponse.json({
    suggestions: suggestions.map(s => ({ ...s, label: formatBestTime(s.weekday, s.hour) })),
  })
}
