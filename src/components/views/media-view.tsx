'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Image as ImageIcon,
  Folder,
  FolderPlus,
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
  Tag,
  RotateCw,
  Recycle,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatNumber, formatCompact, relativeTime } from '@/lib/jalali'
import Image from 'next/image'
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
  createdAt: string | null
}

interface FolderSummary {
  folder: string
  count: number
}

function fileKind(ft: string): 'image' | 'video' | 'file' {
  if (ft.startsWith('image/')) return 'image'
  if (ft.startsWith('video/')) return 'video'
  return 'file'
}

export function MediaView() {
  const [folder, setFolder] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selected, setSelected] = useState<MediaItem | null>(null)
  const [folderManageOpen, setFolderManageOpen] = useState(false)
  const queryClient = useQueryClient()

  // Issue #210: debounced search — only fire the search request after the user
  // stops typing for 300ms. The plain list query is still used when no filters
  // are active so the existing cursor-paginated flow keeps working.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const isFiltering = debouncedSearch.trim() !== '' || folder !== 'all' || tagFilter !== null

  // Plain list — used when no filters are active.
  const { data: mediaList, isLoading: listLoading, isError: listError, refetch: refetchList } = useQuery<MediaItem[]>({
    queryKey: ['media'],
    queryFn: () => api.getPaginated<MediaItem>('/api/media'),
    enabled: !isFiltering,
  })

  // Search — used whenever a filter is active.
  const { data: searchResult, isLoading: searchLoading, isError: searchError, refetch: refetchSearch } = useQuery<{ data: MediaItem[]; folders: FolderSummary[] }>({
    queryKey: ['media-search', debouncedSearch, folder, tagFilter],
    queryFn: () => {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set('q', debouncedSearch)
      if (folder !== 'all') params.set('folder', folder)
      if (tagFilter) params.set('tag', tagFilter)
      return api.get<{ data: MediaItem[]; folders: FolderSummary[] }>(`/api/media/search?${params.toString()}`)
    },
    enabled: isFiltering,
  })

  const media = isFiltering ? (searchResult?.data ?? []) : (mediaList ?? [])
  const isLoading = isFiltering ? searchLoading : listLoading
  const isError = isFiltering ? searchError : listError
  const refetch = isFiltering ? refetchSearch : refetchList

  // Real upload: presign → PUT to storage → confirm + magic-byte validation.
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useMutation<MediaItem, Error, File>({
    mutationFn: async (file) => {
      const presignRes = await fetch('/api/media/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({ error: 'خطا در آماده‌سازی آپلود' }))
        throw new Error(err.error || `آپلود ناموفق: ${file.name}`)
      }
      const { uploadUrl, mediaId } = await presignRes.json()

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })
      if (!uploadRes.ok) {
        throw new Error(`آپلود ناموفق: ${file.name}`)
      }

      const confirmRes = await fetch('/api/media/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mediaId }),
      })
      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({ error: 'اعتبارسنجی ناموفق' }))
        throw new Error(err.error || `فایل نامعتبر: ${file.name}`)
      }
      const data = await confirmRes.json()
      return data.media as MediaItem
    },
    onSuccess: (_media, file) => {
      toast.success(`${file.name} آپلود شد ✓`)
      announce('رسانه جدید اضافه شد')
    },
    onError: (err) => {
      toast.error(err.message || 'آپلود رسانه ناموفق بود.')
      announce('خطا در آپلود رسانه', 'assertive')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-search'] })
    },
  })

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return
    const files = Array.from(e.target.files)
    files.forEach((file) => uploadMutation.mutate(file))
    e.target.value = ''
    setUploadOpen(false)
  }

  // Folders come from the active query result.
  const folders: FolderSummary[] = useMemo(() => {
    if (isFiltering && searchResult?.folders) {
      return searchResult.folders
    }
    // Derive from the plain list when not filtering.
    const map: Record<string, number> = {}
    ;(mediaList ?? []).forEach((m) => {
      map[m.folder] = (map[m.folder] ?? 0) + 1
    })
    return Object.entries(map).map(([folder, count]) => ({ folder, count }))
  }, [isFiltering, searchResult, mediaList])

  // All tags across the visible media — for the chip filter row.
  const allTags = useMemo(() => {
    const set = new Set<string>()
    media.forEach((m) => m.tags.forEach((t) => set.add(t)))
    return Array.from(set).slice(0, 24)
  }, [media])

  // Folder management mutations.
  const renameFolderMutation = useMutation({
    mutationFn: async ({ oldName, newName }: { oldName: string; newName: string }) =>
      api.post<{ moved: number }>('/api/media/search', { action: 'renameFolder', oldName, newName }),
    onSuccess: (data) => {
      toast.success(`${toPersianDigits(data.moved)} رسانه به پوشه جدید منتقل شد`)
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-search'] })
      setFolderManageOpen(false)
    },
    onError: () => toast.error('خطا در تغییر نام پوشه'),
  })

  const deleteFolderMutation = useMutation({
    mutationFn: async (folderName: string) =>
      api.post<{ moved: number }>('/api/media/search', { action: 'deleteFolder', folder: folderName }),
    onSuccess: (data) => {
      toast.success(`${toPersianDigits(data.moved)} رسانه به پوشه عمومی منتقل شد`)
      setFolder('all')
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-search'] })
      setFolderManageOpen(false)
    },
    onError: () => toast.error('خطا در حذف پوشه'),
  })

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
            {toPersianDigits(media.length)} رسانه
          </span>
        }
      >
        کتابخانه رسانه
      </SectionTitle>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Folder sidebar */}
        <aside className="n-card p-3 h-fit lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-3 px-2">
            <div className="flex items-center gap-2">
              <Folder className="size-4 text-accent" />
              <p className="text-sm font-semibold text-ink-primary">پوشه‌ها</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 n-focus-ring"
              onClick={() => setFolderManageOpen(true)}
              aria-label="مدیریت پوشه‌ها"
              title="مدیریت پوشه‌ها"
            >
              <FolderPlus className="size-3.5" />
            </Button>
          </div>
          <div className="space-y-1 max-h-72 lg:max-h-none overflow-y-auto thin-scrollbar">
            <button
              onClick={() => setFolder('all')}
              className={cn(
                'n-focus-ring w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                folder === 'all'
                  ? 'bg-accent-soft text-accent font-bold'
                  : 'text-ink-secondary hover:bg-surface-hover'
              )}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Folder className="size-3.5 shrink-0" />
                <span className="truncate">همه</span>
              </span>
              <span className="text-2xs text-ink-tertiary num-tabular shrink-0">
                {toPersianDigits(media.length)}
              </span>
            </button>
            {folders.map((f) => {
              const active = folder === f.folder
              return (
                <button
                  key={f.folder}
                  onClick={() => setFolder(f.folder)}
                  className={cn(
                    'n-focus-ring w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-sm transition-colors',
                    active
                      ? 'bg-accent-soft text-accent font-bold'
                      : 'text-ink-secondary hover:bg-surface-hover'
                  )}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Folder className="size-3.5 shrink-0" />
                    <span className="truncate">{f.folder}</span>
                  </span>
                  <span className="text-2xs text-ink-tertiary num-tabular shrink-0">
                    {toPersianDigits(f.count)}
                  </span>
                </button>
              )
            })}
            {folders.length === 0 && (
              <p className="text-xs text-ink-tertiary px-3 py-4 text-center">پوشه‌ای یافت نشد</p>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Top bar — search + layout switcher + upload */}
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
            {/* Tag chips row — visible only when there are tags among the visible media */}
            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t border-border">
                <Tag className="size-3.5 text-ink-tertiary shrink-0" />
                <span className="text-2xs text-ink-tertiary shrink-0">برچسب‌ها:</span>
                {allTags.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTagFilter(tagFilter === t ? null : t)}
                    className={cn(
                      'n-focus-ring text-2xs px-2 py-0.5 rounded-full transition-colors',
                      tagFilter === t
                        ? 'bg-accent text-white'
                        : 'bg-surface-subtle text-ink-secondary hover:bg-surface-hover'
                    )}
                  >
                    {t}
                  </button>
                ))}
                {tagFilter && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-2xs"
                    onClick={() => setTagFilter(null)}
                  >
                    پاک کردن فیلتر
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Media grid/list */}
          <LoadingState
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            errorLabel="خطا در بارگذاری رسانه‌ها"
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
            {media.length === 0 ? (
              <div className="n-card p-12">
                <EmptyState
                  icon={ImageIcon}
                  title="رسانه‌ای یافت نشد"
                  message={isFiltering ? 'با فیلترهای دیگر امتحان کنید.' : 'اولین رسانه را آپلود کنید تا اینجا نمایش داده شود.'}
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
                {media.map((m) => (
                  <MediaGridCard key={m.id} item={m} onClick={() => setSelected(m)} />
                ))}
              </div>
            ) : (
              <div className="n-card p-2 space-y-1">
                {media.map((m) => (
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
            <p className="text-xs text-ink-tertiary mt-1">JPG, PNG, WebP, GIF — MP4, MOV, WebM (حداکثر ۲۰۰MB)</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              aria-label="آپلود فایل تصویری یا ویدیویی"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-3 n-focus-ring"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? 'در حال آپلود…' : 'انتخاب فایل'}
            </Button>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="n-focus-ring" onClick={() => setUploadOpen(false)}>
              انصراف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder management dialog */}
      <Dialog open={folderManageOpen} onOpenChange={setFolderManageOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-start">مدیریت پوشه‌ها</DialogTitle>
            <DialogDescription className="text-start">
              تغییر نام یا حذف پوشه‌ها. حذف پوشه، رسانه‌های داخل آن را به پوشه «عمومی» منتقل می‌کند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-72 overflow-y-auto thin-scrollbar">
            {folders.length === 0 ? (
              <p className="text-sm text-ink-tertiary text-center py-4">پوشه‌ای وجود ندارد</p>
            ) : (
              folders.map((f) => (
                <FolderManageRow
                  key={f.folder}
                  folder={f.folder}
                  count={f.count}
                  onRename={(newName) =>
                    renameFolderMutation.mutate({ oldName: f.folder, newName })
                  }
                  onDelete={() => deleteFolderMutation.mutate(f.folder)}
                  isRenaming={renameFolderMutation.isPending}
                  isDeleting={deleteFolderMutation.isPending}
                />
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" className="n-focus-ring" onClick={() => setFolderManageOpen(false)}>
              بستن
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
                <SafeImage src={selected.thumbnail} alt={selected.name} className="relative aspect-square rounded-xl overflow-hidden bg-surface-subtle" />
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
                  <MetaRow
                    label="تاریخ آپلود"
                    value={selected.createdAt ? relativeTime(new Date(selected.createdAt)) : '—'}
                  />
                  {/* Issue #210: reuse-tracking indicator */}
                  <ReuseIndicator mediaId={selected.id} />
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

/** Issue #210: per-folder rename + delete row inside the management dialog. */
function FolderManageRow({
  folder,
  count,
  onRename,
  onDelete,
  isRenaming,
  isDeleting,
}: {
  folder: string
  count: number
  onRename: (newName: string) => void
  onDelete: () => void
  isRenaming: boolean
  isDeleting: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(folder)
  return (
    <div className="flex items-center gap-2 p-2 rounded-xl hover:bg-surface-subtle">
      <Folder className="size-4 text-accent shrink-0" />
      {editing ? (
        <Input
          dir="rtl"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 flex-1"
          autoFocus
        />
      ) : (
        <span className="text-sm font-semibold text-ink-primary flex-1 truncate">{folder}</span>
      )}
      <span className="text-2xs text-ink-tertiary num-tabular shrink-0">{toPersianDigits(count)}</span>
      {editing ? (
        <>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            disabled={isRenaming || !name.trim() || name.trim() === folder}
            onClick={() => {
              onRename(name.trim())
              setEditing(false)
            }}
          >
            ذخیره
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => {
              setName(folder)
              setEditing(false)
            }}
          >
            انصراف
          </Button>
        </>
      ) : (
        <>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 n-focus-ring"
            onClick={() => setEditing(true)}
            aria-label={`تغییر نام پوشه ${folder}`}
            disabled={isRenaming || isDeleting}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7 n-focus-ring text-danger hover:text-danger"
            onClick={() => {
              if (confirm(`پوشه «${folder}» حذف شود؟ رسانه‌ها به پوشه عمومی منتقل می‌شوند.`)) {
                onDelete()
              }
            }}
            aria-label={`حذف پوشه ${folder}`}
            disabled={isRenaming || isDeleting}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </>
      )}
    </div>
  )
}

/** Issue #210: reuse-tracking — shows "استفاده‌شده در N محتوا" badge. */
function ReuseIndicator({ mediaId }: { mediaId: string }) {
  const { data } = useQuery<{ count: number }>({
    queryKey: ['media-reuse', mediaId],
    queryFn: () => api.get(`/api/media/${mediaId}/reuse`),
    staleTime: 60_000,
  })
  const count = data?.count ?? 0
  return (
    <div className="flex items-center gap-2 text-xs">
      <Recycle className="size-3.5 text-ink-tertiary" />
      <span className="text-ink-tertiary">استفاده در محتوا:</span>
      <span className={cn('font-bold num-tabular', count > 0 ? 'text-success' : 'text-ink-tertiary')}>
        {toPersianDigits(count)} مورد
      </span>
    </div>
  )
}

function MediaGridCard({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const kind = fileKind(item.fileType)
  const [imgError, setImgError] = useState(false)
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
      <div className="relative aspect-square bg-surface-subtle">
        {item.thumbnail && !imgError ? (
          <Image
            src={item.thumbnail}
            alt={item.name}
            fill
            unoptimized={item.thumbnail.startsWith('http')}
            onError={() => setImgError(true)}
            className="object-cover"
          />
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
                routerNavigateToCompose()
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
          <span className="text-2xs text-ink-tertiary truncate max-w-20">{item.folder}</span>
        </div>
      </div>
    </div>
  )
}

function routerNavigateToCompose() {
  // Keep the router usage centralized so the grid card stays a pure component.
  if (typeof window !== 'undefined') window.location.href = '/compose'
}

function MediaListRow({ item, onClick }: { item: MediaItem; onClick: () => void }) {
  const router = useRouter()
  const [imgError, setImgError] = useState(false)
  return (
    <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-subtle transition-colors">
      <button
        onClick={onClick}
        className="n-focus-ring flex items-center gap-3 flex-1 min-w-0 text-start"
      >
        {item.thumbnail && !imgError ? (
          <div className="size-12 rounded-lg bg-surface-subtle shrink-0 overflow-hidden">
            <Image
              src={item.thumbnail}
              alt={item.name}
              width={48}
              height={48}
              unoptimized={item.thumbnail.startsWith('http')}
              onError={() => setImgError(true)}
              className="size-12 object-cover"
            />
          </div>
        ) : (
          <div className="size-12 rounded-lg bg-surface-subtle flex items-center justify-center shrink-0">
            <ImageIcon className="size-4 text-ink-tertiary opacity-40" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-primary truncate">{item.name}</p>
          <p className="text-xs text-ink-tertiary truncate">
            {item.folder} • {formatCompact(item.fileSize)}
            {item.tags.length > 0 && ` • ${item.tags.slice(0, 3).join('، ')}`}
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
          <DropdownMenuItem onClick={() => router.push('/compose')}>
            <Send className="size-3.5" /> استفاده در محتوا
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push('/compose')}>
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

/** Issue #298: broken-image fallback for the detail dialog. */
function SafeImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [err, setErr] = useState(false)
  return (
    <div className={className}>
      {!err ? (
        <Image src={src} alt={alt} fill unoptimized={src.startsWith('http')} onError={() => setErr(true)} className="object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <RotateCw className="size-10 text-ink-tertiary opacity-40" />
        </div>
      )}
    </div>
  )
}
