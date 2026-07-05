/**
 * Issue #250: Public Smart Page route — `/p/[slug]`.
 *
 * Server Component. Reads the page directly from the Smart Pages service
 * (no auth — this is a public, shareable URL). Renders the SmartPageView
 * with the workspace's brand colors injected as CSS custom properties so
 * the entire public page adopts the workspace's identity.
 *
 * If the page does not exist or is not published → notFound() (404).
 *
 * `generateMetadata` populates <title> + OpenGraph tags for nice link
 * previews when the URL is shared on social platforms.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { smartPagesService, SmartPageNotFoundError } from '@/modules/smart-pages'
import { SmartPageView } from '@/components/views/smart-page-view'

export const dynamic = 'force-dynamic'

interface SmartPageRouteParams {
  slug: string
}

async function getPage(slug: string) {
  try {
    const page = await smartPagesService.findBySlug(slug)
    if (!page.isPublished) return null
    return page
  } catch (err) {
    if (err instanceof SmartPageNotFoundError) return null
    // Surface unexpected errors (DB down, etc.) as 404 to avoid leaking internals.
    return null
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<SmartPageRouteParams>
}): Promise<Metadata> {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) {
    return { title: 'صفحه پیدا نشد' }
  }

  const title = page.title
  const description = page.description ?? page.workspaceName
  const ogImage = page.avatarUrl ?? undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      ...(ogImage ? { images: [{ url: ogImage }] } : {}),
    },
    twitter: {
      card: 'summary',
      title,
      description,
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  }
}

export default async function SmartPageRoute({
  params,
}: {
  params: Promise<SmartPageRouteParams>
}) {
  const { slug } = await params
  const page = await getPage(slug)
  if (!page) notFound()

  // Inject the workspace's brand colors as CSS custom properties. The
  // --n-accent / --n-accent-soft / --n-accent-hover cascade is what every
  // Tailwind `bg-accent` / `text-accent` / `border-accent` utility resolves
  // to, so overriding them on the wrapper element themes the entire page.
  // We also set --n-primary for the avatar ring / brand-identity surfaces.
  const style = {
    '--n-accent': page.brandAccentColor,
    '--n-accent-hover': page.brandAccentColor,
    '--n-accent-soft': `${page.brandAccentColor}22`, // 13% alpha halo
    '--n-accent-tint': `${page.brandAccentColor}17`, // 9% alpha background
    '--n-primary': page.brandPrimaryColor,
  } as React.CSSProperties

  return (
    <div style={style} className="min-h-dvh bg-canvas">
      <SmartPageView page={page} />
    </div>
  )
}
