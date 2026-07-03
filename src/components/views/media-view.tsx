'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Image as ImageIcon,
  Folder,
  UploadCloud,
  Search,
  Grid2x2,
  List,
  MoreHorizontal,
  Pencil,
  Trash2,
  Send,
  Plus,
  FileVideo,
  FileImage,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatNumber, formatCompact, relativeTime } from '@/lib/jalali'
import { SectionTitle, EmptyState, Skeleton, LoadingState } from '@/components/dashboard/shared'
import { announce } from '@/lib/aria-live'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface MediaItem {
  id: string
  name: string
  fileType: string
  fileSize: number
  url: string
  thumbnail: string
  folder: string
  tags: string[]
  width: number | null
  height: number | null
  createdAt: string
}

function fileKind(ft: string): 'image' | 'video' | 'file' {
  if (ft.startsWith('image/')) return 'image'
  if (ft.startsWith('video/')) return 'video'
  return 'file'
}

export function MediaView() {
  const [folder, setFolder] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const queryClient = useQueryClient()

  const { data: media, isLoading } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.getPaginated<MediaItem>('/api/media'),
  })

  // Optimistic upload: append a placeholder media item to the ["media"] cache
  // in <100ms. The backend upload endpoint is not wired yet; mutationFn resolves
  // immediately so the optimistic row remains visible.
  const uploadMutation = useMutation<MediaItem, Error, MediaItem>({
    mutationFn: async (newItem) => {
      await new Promise((r) => setTimeout(r, 120))
      return newItem
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['media'] })
      const previous = queryClient.getQueryData<MediaItem[]>(['media'])
      queryClient.setQueryData<MediaItem[]>(['media'], (old) => [newItem, ...(old ?? [])])
      announce('رسانه جدید اضافه شد')
      return { previous }
    },
    onError: (_err, _newItem, context: any) => {
      if (context?.previous) queryClient.setQueryData(['media'], context.previous)
      toast.error('آپلود رسانه ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در آپلود رسانه', 'assertive')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
    },
  })

  const handleUpload = () => {
    const newItem: MediaItem = {
      id: `optimistic-${Date.now()}`,
      name: 'رسانه جدید',
      fileType: 'image/png',
      fileSize: 0,
      url: '',
      thumbnail: '',
      folder: folder === 'all' ? 'عمومی' : folder,
      tags: [],
      width: null,
      height: null,
      createdAt: new Date().toISOString(),
    }
    uploadMutation.mutate(newItem)
    setUploadOpen(false)
    toast.success('رسانه با موفقیت آپلود شد.')
  }

  const folders = useMemo(() => {
    const set = new Set<string>()
    ;(media ?? []).forEach((m) => set.add(m.folder))
    return ['all', ...Array.from(set)]
  }, [media])

  const filtered = useMemo(() => {
    if (!media) return []
    return media.filter((m) => {
      if (folder !== 'all' && m.folder !== folder) return false
      if (search && !m.name.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [media, folder, search])

  const folderCounts = useMemo(() => {
    const map: Record<string, number> = {}
    ;(media ?? []).forEach((m) => {
      map[m.folder] = (map[m.folder] ?? 0) + 1
    })
    return map
  }, [media])

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={ImageIcon}
        badge={
          <span className="text-xs text-ink-tertiary num-tabular">
            {toPersianDigits(media?.length ?? 0)} رسانه
          </span>
        }
      >
        کتابخانه رسانه
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Folder sidebar */}
        <aside className="n-card p-3 h-fit lg:sticky lg:top-4">
          <div className="flex items-center gap-2 mb-3 px-2">
            <Folder className="size-4 text-accent" />
            <p className="text-sm font-semibold text-ink-primary">پوشه‌ها</p>
          </div>
          <div className="space-y-1 max-h-72 lg:max-h-none overflow-y-auto thin-scrollbar">
            {folders.map((f) => {
              const active = folder === f
              const count = f === 'all' ? (media?.length ?? 0) : (folderCounts[f] ?? 0)
              const label = f === 'all' ? 'همه' : f
              return (
                <button
                  key={f}
                  onClick={() => setFolder(f)}
                  className={cn(
                    'n-focus-ring w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                    active
                      ? 'bg-accent-soft text-accent font-bold'
                      : 'text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Folder className="size-3.5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="text-2xs text-ink-tertiary num-tabular shrink-0">
                    {toPersianDigits(count)}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Top bar */}
          <div className="n-card n-gradient-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary" />
                <Input
                  dir="rtl"
                  placeholder="جستجوی رسانه…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="ps-9"
                />
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-border p-0.5 bg-surface-subtle">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-8 n-focus-ring',
                    layout === 'grid' && 'bg-accent-soft text-accent'
                  )}
                  onClick={() => setLayout('grid')}
                  aria-label="نمای شبکه‌ای"
                >
                  <Grid2x2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'size-8 n-focus-ring',
                    layout === 'list' && 'bg-accent-soft text-accent'
                  )}
                  onClick={() => setLayout('list')}
                  aria-label="نمای لیستی"
                >
                  <List className="size-4" />
                </Button>
              </div>
              <Button size="sm" className="n-focus-ring" onClick={() => setUploadOpen(true)}>
                <UploadCloud className="size-4" />
                آپلود رسانه
              </Button>
            </div>
          </div>

          {/* Media grid/list */}
          <LoadingState
            isLoading={isLoading}
            skeleton={
              <div className="n-card p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="aspect-square rounded-xl" />
                  ))}
                </div>
              </div>
            }
          >
            {filtered.length === 0 ? (
              <div className="n-card p-12">
                <EmptyState
                  icon={ImageIcon}
                  title="رسانه‌ای یافت نشد"
                  message="اولین رسانه را آپلود کنید تا اینجا نمایش داده شود."
                  illustration="media"
                  action={
                    <Button size="sm" className="n-focus-ring" onClick={() => setUploadOpen(true)}>
                      <Plus className="size-4" />
                      آپلود اولین رسانه
                    </Button>
                  }
                />
              </div>
            ) : layout === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filtered.map((m) => (
                  <MediaGridCard key={m.id} item={m} onClick={() => setSelected(m)} />
                ))}
              </div>
            ) : (
              <div className="n-card p-2 space-y-1">
                {filtered.map((m) => (
                  <MediaListRow key={m.id} item={m} onClick={() => setSelected(m)} />
                ))}
              </div>
            )}
          </LoadingState>
        </div>
      </div>

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-start">آپلود رسانه جدید</DialogTitle>
            <DialogDescription className="text-start">
              یک یا چند فایل را برای آپلود انتخاب کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center bg-surface-subtle">
            <UploadCloud className="size-10 text-ink-tertiary mx-auto mb-3" />
            <p className="text-sm font-semibold text-ink-primary">فایل‌ها را بکشید و رها کنید</p>
            <p className="text-xs text-ink-tertiary mt-1">JPG, PNG, MP4 — حداکثر ۵۰MB</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 n-focus-ring"
              onClick={() => toast.info('آپلود شبیه‌سازی‌شده با موفقیت انجام شد.')}
            >
              انتخاب فایل
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="n-focus-ring" onClick={() => setUploadOpen(false)}>
              انصراف
            </Button>
            <Button
              className="n-focus-ring"
              onClick={handleUpload}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'در حال آپلود…' : 'آپلود'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="sm:max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="text-start">{selected.name}</DialogTitle>
                <DialogDescription className="text-start">
                  {selected.folder} • {formatNumber(selected.fileSize)} بایت
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="aspect-square rounded-xl overflow-hidden bg-border">
                  <img
                    src={selected.thumbnail}
                    alt={selected.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2 text-sm">
                  <MetaRow label="نوع فایل" value={selected.fileType} />
                  <MetaRow
                    label="ابعاد"
                    value={
                      selected.width && selected.height
                        ? `${toPersianDigits(selected.width)} × ${toPersianDigits(selected.height)}`
                        : '—'
                    }
                  />
                  <MetaRow label="حجم" value={`${formatCompact(selected.fileSize)} بایت`} />
                  <MetaRow label="پوشه" value={selected.folder} />
                  <MetaRow label="تاریخ آپلود" value={relativeTime(new Date(selected.createdAt))} />
                  {selected.tags.length > 0 && (
                    <div>
                      <p className="text-ink-tertiary mb-1">برچسب‌ها</p>
                      <div className="flex flex-wrap gap-1">
                        {selected.tags.map((t) => (
                          <Badge key={t} variant="secondary" className="text-2xs">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-3 n-focus-ring"
                    onClick={() => toast.info('ویرایش تصویر به‌زودی فعال خواهد شد.')}
                  >
                    <Pencil className="size-3.5" />
                    ویرایش تصویر
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}

function MediaGridCard({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const kind = fileKind(item.fileType)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className="group n-card-interactive n-focus-ring p-0 overflow-hidden text-start hover:scale-[1.02] transition-transform cursor-pointer"
    >
      <div className="relative aspect-square bg-border">
        {item.thumbnail ? (
          <img src={item.thumbnail} alt={item.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="size-8 text-ink-tertiary opacity-40" />
          </div>
        )}
        <div className="absolute top-2 start-2">
          {kind === 'video' ? (
            <span className="inline-flex items-center gap-1 bg-black/60 text-white text-2xs px-1.5 py-0.5 rounded-full">
              <FileVideo className="size-2.5" /> ویدئو
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 bg-black/60 text-white text-2xs px-1.5 py-0.5 rounded-full">
              <FileImage className="size-2.5" /> عکس
            </span>
          )}
        </div>
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="size-8 n-focus-ring text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                onClick()
              }}
              aria-label="مشاهده"
            >
              <Search className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 n-focus-ring text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                toast.info('استفاده در محتوا به‌زودی فعال خواهد شد.')
              }}
              aria-label="استفاده"
            >
              <Send className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-8 n-focus-ring text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                toast.error('حذف نیازمند تأیید است.')
              }}
              aria-label="حذف"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-sm font-semibold text-ink-primary truncate">{item.name}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-2xs text-ink-tertiary">{formatCompact(item.fileSize)}</span>
          <span className="text-2xs text-ink-tertiary">{item.folder}</span>
        </div>
      </div>
    </div>
  )
}

function MediaListRow({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-subtle transition-colors">
      <button
        onClick={onClick}
        className="n-focus-ring flex items-center gap-3 flex-1 min-w-0 text-start"
      >
        {item.thumbnail ? (
          <img
            src={item.thumbnail}
            alt={item.name}
            className="size-12 rounded-lg object-cover shrink-0"
          />
        ) : (
          <div className="size-12 rounded-lg bg-border flex items-center justify-center shrink-0">
            <ImageIcon className="size-4 text-ink-tertiary opacity-40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-primary truncate">{item.name}</p>
          <p className="text-xs text-ink-tertiary">
            {item.folder} • {formatCompact(item.fileSize)}
          </p>
        </div>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-8 shrink-0 n-focus-ring">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onClick}>
            <Search className="size-3.5" /> مشاهده
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.info('استفاده در محتوا به‌زودی فعال خواهد شد.')}>
            <Send className="size-3.5" /> استفاده در محتوا
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => toast.info('ویرایش به‌زودی فعال خواهد شد.')}>
            <Pencil className="size-3.5" /> ویرایش
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-danger focus:text-danger"
            onClick={() => toast.error('حذف نیازمند تأیید است.')}
          >
            <Trash2 className="size-3.5" /> حذف
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-tertiary">{label}</span>
      <span className="text-ink-primary font-semibold text-left truncate max-w-48">{value}</span>
    </div>
  )
}
