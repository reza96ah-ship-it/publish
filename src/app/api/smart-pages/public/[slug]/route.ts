/**
 * Issue #250: Public smart-page lookup by slug.
 *
 * GET /api/smart-pages/public/[slug]
 *
 * No auth. Returns the published SmartPage + workspace brand colors so any
 * public caller (the SSR /p/[slug] route when it can't run server-side, an
 * embed widget, a future mobile app) can render the page with the workspace's
 * identity. Increments the views counter as a side effect (same as the
 * service's findBySlug — be aware before polling this endpoint from a SPA).
 *
 * Unpublished pages return 404 to avoid leaking draft content.
 */

import { NextResponse } from 'next/server'
import { smartPagesService, SmartPageNotFoundError } from '@/modules/smart-pages'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params

  try {
    const page = await smartPagesService.findBySlug(slug)
    if (!page.isPublished) {
      return NextResponse.json(
        { error: 'صفحه منتشر نشده است' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      {
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          description: page.description,
          avatarUrl: page.avatarUrl,
          blocks: page.blocks,
          isPublished: page.isPublished,
          views: page.views,
          clicks: page.clicks,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
        },
        workspace: {
          name: page.workspaceName,
          brandPrimaryColor: page.brandPrimaryColor,
          brandAccentColor: page.brandAccentColor,
        },
      },
      {
        headers: {
          // Public pages can be cached at the edge for a short window —
          // views are fire-and-forget so a 30s stale window is acceptable.
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (err) {
    if (err instanceof SmartPageNotFoundError) {
      return NextResponse.json({ error: 'صفحه پیدا نشد' }, { status: 404 })
    }
    // Unexpected error — log via the global handler and return 500.
    return NextResponse.json({ error: 'خطای سرور' }, { status: 500 })
  }
}
