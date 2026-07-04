'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  Repeat2,
  ThumbsUp,
  Eye,
} from 'lucide-react'
import { PlatformLogo } from '@/components/ui/platform-logo'
import { cn } from '@/lib/utils'
import { toPersianDigits } from '@/lib/jalali'

interface MediaItem {
  thumbnail: string
  name: string
}

interface PlatformPreviewTabsProps {
  caption: string
  title: string
  hashtags: string
  media: MediaItem[]
  selectedPlatforms: string[]
  authorName?: string
}

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  linkedin: 'لینکدین',
  rubika: 'روبیکا',
  bale: 'بله',
  eitaa: 'ایتا',
}

const PLATFORM_LIMITS: Record<string, number> = {
  instagram: 2200,
  telegram: 4096,
  linkedin: 3000,
  rubika: 4096,
  bale: 4096,
  eitaa: 4096,
}

/**
 * PlatformPreviewTabs — multi-platform live preview (Planable/Buffer style).
 *
 * Shows how the post will look on each selected platform. Tabs let you
 * switch between IG/TG/LinkedIn/Rubika/Bale previews. Each platform has
 * its own visual style (IG square photo, TG channel message, LinkedIn article card).
 *
 * Character count chips show per-platform limit status (green/yellow/red).
 */
export function PlatformPreviewTabs({
  caption,
  title,
  hashtags,
  media,
  selectedPlatforms,
  authorName = 'نشرینو',
}: PlatformPreviewTabsProps) {
  const platforms = useMemo(
    () => (selectedPlatforms.length > 0 ? selectedPlatforms : ['instagram']),
    [selectedPlatforms],
  )

  // Track active tab — reset to first platform when the platform list changes.
  const [active, setActive] = useState(platforms[0])
  const platformsKey = platforms.join(',')
  useEffect(() => {
    if (!platforms.includes(active)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActive(platforms[0])
    }
  }, [platformsKey, active, platforms])

  const fullText = [caption, hashtags].filter(Boolean).join('\n\n')

  return (
    <div className="n-card overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border bg-surface-subtle px-2 py-1.5 overflow-x-auto thin-scrollbar">
        {platforms.map((p) => {
          const limit = PLATFORM_LIMITS[p] ?? 2200
          const len = fullText.length
          const status = len > limit ? 'over' : len > limit * 0.9 ? 'warn' : 'ok'
          return (
            <button
              key={p}
              onClick={() => setActive(p)}
              aria-pressed={active === p}
              className={cn(
                'n-focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0',
                active === p
                  ? 'bg-surface text-ink-primary shadow-sm'
                  : 'text-ink-tertiary hover:bg-surface-hover hover:text-ink-secondary'
              )}
            >
              <PlatformLogo platform={p as string} className="size-3.5" />
              <span>{PLATFORM_LABELS[p] ?? p}</span>
              <span
                className={cn(
                  'ms-1 rounded px-1 text-2xs num-tabular font-bold',
                  status === 'ok' && 'bg-success/10 text-success',
                  status === 'warn' && 'bg-warning/10 text-warning',
                  status === 'over' && 'bg-danger/10 text-danger'
                )}
              >
                {toPersianDigits(len)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Preview content */}
      <div className="p-4 bg-gradient-to-br from-surface-subtle/30 to-surface">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: [0, 0, 0.2, 1] }}
          >
            {active === 'instagram' && (
              <InstagramPreview
                caption={fullText}
                title={title}
                media={media}
                author={authorName}
              />
            )}
            {active === 'telegram' && (
              <TelegramPreview caption={fullText} title={title} media={media} author={authorName} />
            )}
            {active === 'linkedin' && (
              <LinkedInPreview caption={fullText} title={title} media={media} author={authorName} />
            )}
            {(active === 'rubika' || active === 'bale' || active === 'eitaa') && (
              <TelegramPreview
                caption={fullText}
                title={title}
                media={media}
                author={authorName}
                platformName={PLATFORM_LABELS[active]}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ── Instagram Preview ──────────────────────────────────────────────── */
function InstagramPreview({
  caption,
  title: _title,
  media,
  author,
}: {
  caption: string
  title: string
  media: MediaItem[]
  author: string
}) {
  const truncateAt = 125
  const isLong = caption.length > truncateAt
  const displayCaption = isLong ? caption.slice(0, truncateAt) : caption

  return (
    <div className="mx-auto max-w-[320px] bg-surface rounded-xl overflow-hidden border border-border">
      {/* Header: avatar + username */}
      <div className="flex items-center gap-2 p-3">
        <div className="size-8 rounded-full bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 p-0.5">
          <div className="size-full rounded-full bg-surface flex items-center justify-center">
            <span className="text-2xs font-bold text-ink-primary">{author[0]}</span>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-ink-primary truncate">{author}</p>
          <p className="text-2xs text-ink-tertiary">الان</p>
        </div>
        <MoreHorizontal className="size-4 text-ink-tertiary" />
      </div>

      {/* Media (square) */}
      {media[0]?.thumbnail ? (
        <div className="relative aspect-square w-full bg-border">
          <img src={media[0].thumbnail} alt="" className="w-full h-full object-cover" />
          {media.length > 1 && (
            <span className="absolute top-2 left-2 bg-black/60 text-white text-2xs px-1.5 py-0.5 rounded-full num-tabular flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="size-2.5 fill-current">
                <path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM8.5 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm8.5 6l-4-5-2 2-3-4-3 7h12z" />
              </svg>
              {toPersianDigits(media.length)}
            </span>
          )}
        </div>
      ) : (
        <div className="aspect-square w-full bg-surface-hover flex items-center justify-center">
          <span className="text-2xs text-ink-tertiary">بدون رسانه</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 px-3 pt-2.5">
        <Heart className="size-5 text-ink-primary" />
        <MessageCircle className="size-5 text-ink-primary" />
        <Send className="size-5 text-ink-primary" />
        <Bookmark className="size-5 ms-auto text-ink-primary" />
      </div>

      {/* Likes */}
      <div className="px-3 pt-1.5">
        <p className="text-2xs font-bold text-ink-primary">{toPersianDigits(124)} پسند</p>
      </div>

      {/* Caption */}
      <div className="px-3 pb-3 pt-1">
        <p className="text-xs text-ink-primary leading-relaxed whitespace-pre-wrap">
          <span className="font-bold">{author}</span> {displayCaption}
          {isLong && <span className="text-ink-tertiary"> … بیشتر</span>}
        </p>
      </div>
    </div>
  )
}

/* ── Telegram Preview (channel message) ─────────────────────────────── */
function TelegramPreview({
  caption,
  title,
  media,
  author,
  platformName = 'تلگرام',
}: {
  caption: string
  title: string
  media: MediaItem[]
  author: string
  platformName?: string
}) {
  return (
    <div className="mx-auto max-w-[380px]">
      {/* Channel header */}
      <div className="flex items-center gap-2 mb-2 px-1">
        <div className="size-8 rounded-full bg-[#0088cc] flex items-center justify-center text-white text-2xs font-bold">
          {author[0]}
        </div>
        <div>
          <p className="text-xs font-bold text-ink-primary">{author}</p>
          <p className="text-2xs text-ink-tertiary">{platformName} • الان</p>
        </div>
      </div>

      {/* Message bubble */}
      <div className="rounded-2xl rounded-tr-sm bg-surface border border-border p-3 shadow-sm">
        {media[0]?.thumbnail && (
          <div className="mb-2 rounded-lg overflow-hidden">
            <img src={media[0].thumbnail} alt="" className="w-full max-h-[200px] object-cover" />
          </div>
        )}
        {title && <p className="text-sm font-bold text-ink-primary mb-1">{title}</p>}
        <p className="text-xs text-ink-primary leading-relaxed whitespace-pre-wrap">
          {caption || 'متن پیام…'}
        </p>
        {/* Time + views */}
        <div className="flex items-center justify-end gap-1 mt-1.5">
          <Eye className="size-3 text-ink-tertiary" />
          <span className="text-2xs text-ink-tertiary num-tabular">{toPersianDigits(1234)}</span>
          <span className="text-2xs text-ink-tertiary ms-1">۱۲:۳۰</span>
        </div>
      </div>
    </div>
  )
}

/* ── LinkedIn Preview (article card) ────────────────────────────────── */
function LinkedInPreview({
  caption,
  title: _title,
  media,
  author,
}: {
  caption: string
  title: string
  media: MediaItem[]
  author: string
}) {
  const truncateAt = 700
  const isLong = caption.length > truncateAt
  const displayCaption = isLong ? caption.slice(0, truncateAt) : caption

  return (
    <div className="mx-auto max-w-[400px] bg-surface rounded-lg overflow-hidden border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <div className="size-9 rounded-full bg-[#0a66c2] flex items-center justify-center text-white text-xs font-bold">
          {author[0]}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-ink-primary truncate">{author}</p>
          <p className="text-2xs text-ink-tertiary">اکنون • عمومی</p>
        </div>
        <MoreHorizontal className="size-4 text-ink-tertiary" />
      </div>

      {/* Caption (LinkedIn shows text above media) */}
      <div className="px-3 pb-2">
        <p className="text-xs text-ink-primary leading-relaxed whitespace-pre-wrap">
          {displayCaption}
          {isLong && <span className="text-[#0a66c2]"> …دیدن بیشتر</span>}
        </p>
      </div>

      {/* Media (16:9) */}
      {media[0]?.thumbnail && (
        <div className="aspect-video w-full bg-border">
          <img src={media[0].thumbnail} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Reactions */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border">
        <div className="flex items-center gap-1">
          <ThumbsUp className="size-3.5 text-[#0a66c2] fill-[#0a66c2]" />
          <Repeat2 className="size-3.5 text-[#5cb85c]" />
          <span className="text-2xs text-ink-tertiary num-tabular ms-1">
            {toPersianDigits(42)}
          </span>
        </div>
        <span className="text-2xs text-ink-tertiary">{toPersianDigits(7)} نظر</span>
      </div>
    </div>
  )
}
