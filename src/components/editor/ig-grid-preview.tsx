'use client'

/**
 * Issue #219: Instagram grid preview — shows how the post will look
 * in the profile grid (square crop, 3-column layout).
 */
import { Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IgGridPreviewProps {
  caption: string
  mediaUrl?: string
  mediaCount?: number
  className?: string
}

export function IgGridPreview({ caption, mediaUrl, mediaCount = 1, className }: IgGridPreviewProps) {
  // Simulate a 3x3 grid with the current post in the first cell
  const firstLetter = caption?.[0] ?? '؟'

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden bg-surface', className)}>
      <div className="p-3 border-b border-border">
        <p className="text-xs font-bold text-ink-secondary">پیش‌نمایش گرید اینستاگرام</p>
      </div>
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {/* Current post — first cell */}
        <div className="aspect-square bg-surface-subtle flex items-center justify-center relative group">
          {mediaUrl ? (
            <img src={mediaUrl} alt="preview" className="w-full h-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1 text-ink-tertiary">
              <ImageIcon className="size-5" />
              <span className="text-2xs">{mediaCount > 1 ? `${mediaCount} رسانه` : 'تک‌عکس'}</span>
            </div>
          )}
          {mediaCount > 1 && (
            <span className="absolute top-1 right-1 text-2xs bg-black/60 text-white rounded px-1">
              ▦
            </span>
          )}
        </div>
        {/* Placeholder cells */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square bg-surface-subtle/50" />
        ))}
      </div>
      <div className="p-2 border-t border-border">
        <p className="text-2xs text-ink-tertiary truncate" dir="rtl">
          {caption?.slice(0, 50) || 'بدون کپشن'}
        </p>
      </div>
    </div>
  )
}
