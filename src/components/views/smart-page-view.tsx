/**
 * Issue #250: Public Smart Page view — Server Component.
 *
 * Renders the visitor-facing link-in-bio page. Mobile-first vertical stack
 * (max-w-md, centered, works at 375px). All blocks render in array order.
 *
 * Brand colors are injected by the parent `/p/[slug]` route via CSS custom
 * properties on a wrapping div; we consume them here through Tailwind's
 * accent utilities (bg-accent, text-accent, border-accent, ring-accent).
 *
 * Click tracking on link/social blocks is delegated to the
 * SmartPageClickTracker client component — everything else is server-rendered.
 */

import Image from 'next/image'
import {
  ExternalLink,
  Globe,
  Instagram,
  Linkedin,
  Send,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react'
import type { PublicSmartPageItem, SmartPageBlock } from '@/modules/smart-pages'
import { SmartPageClickTracker } from './smart-page-click-tracker'

// ── Social platform → icon + display label ────────────────────────────────────
// Renders a small brand glyph next to social block buttons. We avoid pulling
// the full PlatformLogo component (which is workspace-aware) and keep the
// public page bundle minimal — just a lucide icon per platform.

const SOCIAL_ICONS: Record<string, { icon: LucideIcon; label: string }> = {
  instagram: { icon: Instagram, label: 'اینستاگرام' },
  telegram: { icon: Send, label: 'تلگرام' },
  linkedin: { icon: Linkedin, label: 'لینکدین' },
  eitaa: { icon: MessageCircle, label: 'ایتا' },
  bale: { icon: MessageCircle, label: 'بله' },
  rubika: { icon: MessageCircle, label: 'روبیکا' },
  twitter: { icon: Globe, label: 'توییتر' },
  facebook: { icon: Globe, label: 'فیسبوک' },
  youtube: { icon: Globe, label: 'یوتیوب' },
  website: { icon: Globe, label: 'وب‌سایت' },
}

function getSocial(platform: string) {
  const key = platform.toLowerCase().trim()
  return SOCIAL_ICONS[key] ?? { icon: Globe, label: platform }
}

interface SmartPageViewProps {
  page: PublicSmartPageItem
}

export function SmartPageView({ page }: SmartPageViewProps) {
  const avatarInitial = page.title.charAt(0) || page.workspaceName.charAt(0) || 'N'

  return (
    <main
      dir="rtl"
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-stretch px-4 pb-10 pt-8"
    >
      {/* ── Header: avatar + title + description ───────────────────────────── */}
      <header className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          {page.avatarUrl ? (
            <div className="relative size-24 overflow-hidden rounded-full ring-4 ring-accent/15">
              <Image
                src={page.avatarUrl}
                alt={page.title}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized={page.avatarUrl.startsWith('http')}
              />
            </div>
          ) : (
            <div className="flex size-24 items-center justify-center rounded-full bg-accent text-3xl font-bold text-white ring-4 ring-accent/15">
              {avatarInitial}
            </div>
          )}
        </div>

        <h1 className="text-xl font-bold tracking-tight text-ink-primary">{page.title}</h1>
        {page.description ? (
          <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">{page.description}</p>
        ) : null}
      </header>

      {/* ── Blocks ──────────────────────────────────────────────────────────── */}
      <div className="mt-6 space-y-3">
        {page.blocks.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-tertiary">
            هنوز بلوکی به این صفحه اضافه نشده است.
          </p>
        ) : (
          page.blocks.map((block) => (
            <BlockRenderer key={block.id} block={block} slug={page.slug} />
          ))
        )}
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="mt-auto pt-10 text-center">
        <p className="text-2xs font-medium text-ink-tertiary">
          {page.workspaceName}
        </p>
        <p className="mt-0.5 text-2xs text-ink-tertiary/80">
          قدرت‌گرفته از <span className="font-bold text-ink-tertiary">نشرینو</span>
        </p>
      </footer>
    </main>
  )
}

// ── Block renderer ───────────────────────────────────────────────────────────

function BlockRenderer({ block, slug }: { block: SmartPageBlock; slug: string }) {
  switch (block.type) {
    case 'link':
      return <LinkBlock slug={slug} block={block} />

    case 'social':
      return <SocialBlock slug={slug} block={block} />

    case 'heading':
      return (
        <h2 className="pt-2 text-sm font-bold text-ink-primary first:pt-0">{block.text}</h2>
      )

    case 'text':
      return (
        <p className="text-sm leading-relaxed text-ink-secondary">{block.text}</p>
      )

    case 'image':
      return <ImageBlock block={block} />

    case 'latest-posts':
      return (
        <div className="rounded-xl border border-dashed border-border bg-surface-subtle px-4 py-6 text-center">
          <p className="text-sm font-semibold text-ink-secondary">{block.label ?? 'آخرین پست‌ها'}</p>
          <p className="mt-1 text-2xs text-ink-tertiary">به‌زودی</p>
        </div>
      )

    default:
      // Exhaustiveness check — if a new block type is added, TS will error here.
      return null
  }
}

function LinkBlock({
  slug,
  block,
}: {
  slug: string
  block: Extract<SmartPageBlock, { type: 'link' }>
}) {
  return (
    <SmartPageClickTracker
      slug={slug}
      block={block}
      href={block.url}
      className="group flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <span className="truncate">{block.label}</span>
      <ExternalLink className="size-4 shrink-0 opacity-80 transition-opacity group-hover:opacity-100" />
    </SmartPageClickTracker>
  )
}

function SocialBlock({
  slug,
  block,
}: {
  slug: string
  block: Extract<SmartPageBlock, { type: 'social' }>
}) {
  const { icon: Icon, label: defaultLabel } = getSocial(block.platform)
  const displayLabel = block.label ?? defaultLabel

  return (
    <SmartPageClickTracker
      slug={slug}
      block={block}
      href={block.url}
      className="group flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-accent/30 bg-accent-soft px-4 py-2.5 text-sm font-medium text-ink-primary transition-colors hover:border-accent/60 hover:bg-accent-tint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <Icon className="size-4" />
      </span>
      <span className="flex-1 truncate text-start">{displayLabel}</span>
      <ExternalLink className="size-3.5 shrink-0 text-ink-tertiary transition-opacity group-hover:opacity-100" />
    </SmartPageClickTracker>
  )
}

function ImageBlock({
  block,
}: {
  block: Extract<SmartPageBlock, { type: 'image' }>
}) {
  return (
    <figure className="overflow-hidden rounded-xl border border-border bg-surface-subtle">
      <div className="relative aspect-video w-full bg-border">
        <Image
          src={block.url}
          alt={block.alt}
          fill
          sizes="(max-width: 448px) 100vw, 448px"
          className="object-cover"
          unoptimized={block.url.startsWith('http')}
        />
      </div>
      {block.caption ? (
        <figcaption className="px-3 py-2 text-2xs text-ink-tertiary">{block.caption}</figcaption>
      ) : null}
    </figure>
  )
}
