'use client'

/**
 * Issue #219: Instagram grid preview — shows how the post will look
 * in the profile grid (square crop, 3-column layout). When a platformId
 * is provided, the surrounding cells are filled with the channel's real
 * scheduled + published posts in grid order instead of empty placeholders.
 */
import { useQuery } from '@tanstack/react-query'
import { Clock3, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { IgGridItem } from '@/components/editor/ig-grid-board'

interface IgGridPreviewProps {
  caption: string
  mediaUrl?: string
  mediaCount?: number
  platformId?: string
  className?: string
}

export function IgGridPreview({
  caption,
  mediaUrl,
  mediaCount = 1,
  platformId,
  className,
}: IgGridPreviewProps) {
  const { data } = useQuery<{ items: IgGridItem[] }>({
    queryKey: ['ig-grid', platformId],
    queryFn: () => api.get<{ items: IgGridItem[] }>(`/api/ig-grid?platformId=${platformId}`),
    enabled: !!platformId,
  })
  const neighbors = (data?.items ?? []).slice(0, 8)

  return (
    <div className={cn('rounded-xl border border-border overflow-hidden bg-surface', className)}>
      <div className="p-3 border-b border-border">
        <p className="text-xs font-bold text-ink-secondary">پیش‌نمایش گرید اینستاگرام</p>
      </div>
      <div className="grid grid-cols-3 gap-0.5 p-0.5">
        {/* Current post — first cell */}
        <div className="aspect-square bg-surface-subtle flex items-center justify-center relative ring-1 ring-accent/60">
          {mediaUrl ? (
            <Image
              src={mediaUrl}
              alt="preview"
              fill
              unoptimized={mediaUrl.startsWith('http')}
              className="object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1 text-ink-tertiary">
              <ImageIcon className="size-5" />
              <span className="text-2xs">{mediaCount > 1 ? `${mediaCount} رسانه` : 'تک‌عکس'}</span>
            </div>
          )}
          {mediaCount > 1 && (
            <span className="absolute top-1 end-1 text-2xs bg-black/60 text-white rounded px-1">
              ▦
            </span>
          )}
        </div>
        {/* Neighbor cells: real scheduled/published posts, padded with placeholders */}
        {Array.from({ length: 8 }).map((_, i) => {
          const item = neighbors[i]
          if (!item) {
            return <div key={i} className="aspect-square bg-surface-subtle/50" />
          }
          return (
            <div key={item.jobId} className="aspect-square bg-surface-subtle relative overflow-hidden">
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt={item.title}
                  fill
                  unoptimized={item.thumbnail.startsWith('http')}
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-ink-tertiary">
                  <ImageIcon className="size-4" />
                </div>
              )}
              {item.kind === 'scheduled' && (
                <span className="absolute top-1 start-1 text-white/90 drop-shadow">
                  <Clock3 className="size-3" />
                </span>
              )}
            </div>
          )
        })}
      </div>
      <div className="p-2 border-t border-border">
        <p className="text-2xs text-ink-tertiary truncate" dir="rtl">
          {caption?.slice(0, 50) || 'بدون کپشن'}
        </p>
      </div>
    </div>
  )
}
