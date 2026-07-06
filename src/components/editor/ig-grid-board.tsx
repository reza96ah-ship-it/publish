'use client'

/**
 * Issue #219: full Instagram grid board — mixes scheduled/pending posts with
 * recently published ones in profile-grid order (newest first). Future
 * scheduled items can be drag-reordered: the set of time slots stays fixed
 * and items swap slots, so reordering the grid reschedules accordingly.
 */
import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { CheckCircle2, Clock3, GripVertical, Image as ImageIcon } from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { computeSlotSwap } from '@/lib/ig-grid'
import { JALALI_MONTHS, toJalali, toPersianDigits } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'

export interface IgGridItem {
  jobId: string
  contentId: string
  title: string
  thumbnail: string
  kind: 'scheduled' | 'published'
  at: string | null
  reorderable: boolean
}

function shortJalali(iso: string | null): string {
  if (!iso) return ''
  const j = toJalali(new Date(iso))
  return `${toPersianDigits(j.day)} ${JALALI_MONTHS[j.month - 1]}`
}

function GridCell({ item }: { item: IgGridItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.jobId,
    disabled: !item.reorderable,
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...(item.reorderable ? listeners : {})}
      className={cn(
        'aspect-square relative overflow-hidden bg-surface-subtle group',
        item.reorderable && 'cursor-grab touch-none',
        isDragging && 'opacity-50 z-10 ring-2 ring-accent'
      )}
      aria-label={item.title}
    >
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
          <ImageIcon className="size-5" />
        </div>
      )}

      {item.kind === 'scheduled' ? (
        <span className="absolute top-1 start-1 inline-flex items-center gap-0.5 text-2xs bg-black/60 text-white rounded px-1 py-0.5 num-tabular">
          <Clock3 className="size-2.5" />
          {shortJalali(item.at)}
        </span>
      ) : (
        <span className="absolute bottom-1 end-1 text-white/90 drop-shadow">
          <CheckCircle2 className="size-3.5" />
        </span>
      )}

      {item.reorderable && (
        <span className="absolute bottom-1 start-1 text-white/0 group-hover:text-white/90 transition-colors">
          <GripVertical className="size-3.5" />
        </span>
      )}
    </div>
  )
}

export function IgGridBoard({ platformId, className }: { platformId: string; className?: string }) {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery<{ items: IgGridItem[] }>({
    queryKey: ['ig-grid', platformId],
    queryFn: () => api.get<{ items: IgGridItem[] }>(`/api/ig-grid?platformId=${platformId}`),
  })

  // Local optimistic order while reschedule PATCHes are in flight.
  // Keyed to the server data it was derived from, so a refetch discards it
  // without needing an effect.
  const [localOrder, setLocalOrderState] = useState<{
    base: IgGridItem[]
    order: IgGridItem[]
  } | null>(null)
  const serverItems = data?.items ?? []
  const items = localOrder && localOrder.base === data?.items ? localOrder.order : serverItems
  const setLocalOrder = (order: IgGridItem[] | null) =>
    setLocalOrderState(order && data?.items ? { base: data.items, order } : null)

  const reorderables = useMemo(() => items.filter((i) => i.reorderable), [items])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  )

  const rescheduleMutation = useMutation({
    mutationFn: async (changes: { jobId: string; scheduledAt: string }[]) => {
      await Promise.all(
        changes.map((c) =>
          api.patch(`/api/publish-jobs/${c.jobId}`, {
            action: 'reschedule',
            scheduledAt: c.scheduledAt,
          })
        )
      )
    },
    onSuccess: () => {
      toast.success('ترتیب گرید به‌روزرسانی شد')
      announce('ترتیب گرید به‌روزرسانی شد')
      queryClient.invalidateQueries({ queryKey: ['ig-grid'] })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
      queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در جابه‌جایی گرید')
      setLocalOrder(null)
      queryClient.invalidateQueries({ queryKey: ['ig-grid'] })
    },
  })

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = reorderables.map((i) => i.jobId)
    const from = ids.indexOf(String(active.id))
    const to = ids.indexOf(String(over.id))
    if (from < 0 || to < 0) return

    // Slot times stay fixed to their grid positions; items adopt the slot they land on.
    const { moved, slots, changes } = computeSlotSwap(reorderables, from, to)

    let k = 0
    setLocalOrder(
      items.map((i) => {
        if (!i.reorderable) return i
        const next = { ...moved[k], at: slots[k] }
        k += 1
        return next
      })
    )
    if (changes.length) rescheduleMutation.mutate(changes)
  }

  if (isLoading) {
    return (
      <div className={cn('grid grid-cols-3 gap-0.5', className)}>
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-none" />
        ))}
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className={cn('py-10 text-center text-sm text-ink-tertiary', className)}>
        هنوز پستی برای این کانال ثبت نشده است
      </div>
    )
  }

  // Pad to full rows so the grid silhouette matches an IG profile
  const padCount = (3 - (items.length % 3)) % 3

  return (
    <div className={className}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={reorderables.map((i) => i.jobId)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 gap-0.5 rounded-lg overflow-hidden border border-border">
            {items.map((item) => (
              <GridCell key={item.jobId} item={item} />
            ))}
            {Array.from({ length: padCount }).map((_, i) => (
              <div key={`pad-${i}`} className="aspect-square bg-surface-subtle/50" />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <p className="mt-2 text-2xs text-ink-tertiary">
        پست‌های زمان‌بندی‌شدهٔ آینده را بکشید تا جای آن‌ها در گرید (و زمان انتشارشان) عوض شود
      </p>
    </div>
  )
}

export function IgGridDialog({
  open,
  onOpenChange,
  platforms,
  initialPlatformId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  platforms: { id: string; name: string }[]
  initialPlatformId?: string
}) {
  // Derived fallback instead of a sync effect: an explicit selection wins as
  // long as it's still in the list; otherwise fall back to initial/first.
  const [selected, setSelected] = useState<string | null>(null)
  const platformId =
    selected && platforms.some((p) => p.id === selected)
      ? selected
      : (initialPlatformId ?? platforms[0]?.id ?? '')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[420px]">
        <DialogHeader>
          <DialogTitle>گرید اینستاگرام</DialogTitle>
          <DialogDescription>
            چیدمان پروفایل با پست‌های منتشرشده و زمان‌بندی‌شده
          </DialogDescription>
        </DialogHeader>
        {platforms.length > 1 && (
          <Select value={platformId} onValueChange={setSelected}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="انتخاب کانال" />
            </SelectTrigger>
            <SelectContent>
              {platforms.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {platformId ? (
          <IgGridBoard platformId={platformId} />
        ) : (
          <p className="py-6 text-center text-sm text-ink-tertiary">
            کانال اینستاگرامی متصل نیست
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
