'use client'

/**
 * Issue #250: Smart Pages admin builder view — `/smart-pages`.
 *
 * Client component following the campaigns-view pattern:
 *  - useQuery(['smart-pages']) lists pages via api.getPaginated
 *  - useMutation for create / update / delete with optimistic updates + rollback
 *  - LoadingState + EmptyState + SkeletonCard for loading / empty / error
 *  - Detail <Sheet> for editing: title, slug, description, avatar, blocks
 *    editor (add / remove / reorder up+down), publish toggle, preview button,
 *    QR code image, click analytics summary
 *  - pageTransition + pageTransitionProps for view enter animation
 *  - toast + announce() for accessibility
 *
 * The view assumes the backend agent's `/api/smart-pages` CRUD endpoints
 * (GET/POST/PATCH/DELETE) exist; if any are missing the relevant mutation
 * surfaces a toast.error and TanStack rolls back the optimistic cache.
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Link2,
  Plus,
  ExternalLink,
  Trash2,
  Eye,
  MousePointerClick,
  TrendingUp,
  ChevronUp,
  ChevronDown,
  X,
  GripVertical,
  Link as LinkIcon,
  AtSign,
  Heading,
  Type,
  Image as ImageIcon,
  Clock,
  QrCode,
  Copy,
  ArrowLeft,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  EmptyState,
  LoadingState,
  SkeletonCard,
  StatusBadge,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SmartPageBlock, SmartPageItem } from '@/modules/smart-pages'

// ── Block type metadata ──────────────────────────────────────────────────────
// Drives the "add block" picker + per-block icon in the editor list.

type BlockType = SmartPageBlock['type']

const BLOCK_TYPES: { type: BlockType; label: string; icon: typeof LinkIcon }[] = [
  { type: 'link', label: 'لینک', icon: LinkIcon },
  { type: 'social', label: 'شبکه اجتماعی', icon: AtSign },
  { type: 'heading', label: 'عنوان', icon: Heading },
  { type: 'text', label: 'متن', icon: Type },
  { type: 'image', label: 'تصویر', icon: ImageIcon },
  { type: 'latest-posts', label: 'آخرین پست‌ها', icon: Clock },
]

const SOCIAL_PLATFORMS = [
  'instagram',
  'telegram',
  'linkedin',
  'eitaa',
  'bale',
  'rubika',
  'twitter',
  'facebook',
  'youtube',
  'website',
]

// Stable client-side id generator for optimistic block adds. Matches the
// cuid-like shape Prisma uses so renderers don't trip on length constraints.
function newBlockId() {
  return `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Build an empty block of the given type — used by the "add block" button.
function makeBlock(type: BlockType): SmartPageBlock {
  switch (type) {
    case 'link':
      return { type, id: newBlockId(), label: 'لینک جدید', url: 'https://' }
    case 'social':
      return { type, id: newBlockId(), platform: 'instagram', url: 'https://' }
    case 'heading':
      return { type, id: newBlockId(), text: 'بخش جدید' }
    case 'text':
      return { type, id: newBlockId(), text: '' }
    case 'image':
      return { type, id: newBlockId(), url: 'https://', alt: 'تصویر', caption: '' }
    case 'latest-posts':
      return { type, id: newBlockId(), limit: 5, label: 'آخرین پست‌ها' }
  }
}

// Public URL of a smart page on the current origin.
function publicPageUrl(slug: string) {
  if (typeof window === 'undefined') return `/p/${slug}`
  return `${window.location.origin}/p/${slug}`
}

// QR code via the public api.qrserver.com endpoint — no npm package needed.
function qrCodeUrl(url: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`
}

// ── View ─────────────────────────────────────────────────────────────────────

export function SmartPagesView() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: pages, isLoading, isError, refetch } = useQuery<SmartPageItem[]>({
    queryKey: ['smart-pages'],
    queryFn: () => api.getPaginated<SmartPageItem>('/api/smart-pages'),
  })

  const selected = pages?.find((p) => p.id === selectedId) ?? null

  const stats = useMemo(() => {
    const total = pages?.length ?? 0
    const published = pages?.filter((p) => p.isPublished).length ?? 0
    const totalViews = pages?.reduce((sum, p) => sum + p.views, 0) ?? 0
    const totalClicks = pages?.reduce((sum, p) => sum + p.clicks, 0) ?? 0
    const ctr = totalViews > 0 ? Math.round((totalClicks / totalViews) * 100) : 0
    return { total, published, totalViews, totalClicks, ctr }
  }, [pages])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation<SmartPageItem, Error, SmartPageItem>({
    mutationFn: (item) =>
      api.post<SmartPageItem>('/api/smart-pages', {
        slug: item.slug,
        title: item.title,
        // null → omit so Zod's `.optional()` doesn't reject null on the wire.
        ...(item.description ? { description: item.description } : {}),
        avatarUrl: item.avatarUrl,
        blocks: item.blocks,
        isPublished: item.isPublished,
      }),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['smart-pages'] })
      const previous = queryClient.getQueryData<SmartPageItem[]>(['smart-pages'])
      queryClient.setQueryData<SmartPageItem[]>(['smart-pages'], (old) => [item, ...(old ?? [])])
      announce('صفحه هوشمند جدید ایجاد شد')
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: SmartPageItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['smart-pages'], ctx.previous)
      toast.error(err.message || 'ایجاد صفحه ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در ایجاد صفحه هوشمند', 'assertive')
    },
    onSuccess: () => toast.success('صفحه هوشمند جدید ایجاد شد.'),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['smart-pages'] }),
  })

  const updateMutation = useMutation<SmartPageItem, Error, { id: string; patch: Partial<SmartPageItem> }>({
    mutationFn: ({ id, patch }) => {
      // Zod's `.optional()` rejects `null` on the wire — strip null fields so
      // we don't send `description: null`. (avatarUrl is `.nullable().optional()`
      // so it stays.) Blocks are an array; if absent we omit it entirely.
      const body: Record<string, unknown> = { ...patch }
      if (body.description === null) delete body.description
      if (body.blocks === undefined) delete body.blocks
      return api.patch<SmartPageItem>(`/api/smart-pages/${id}`, body)
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['smart-pages'] })
      const previous = queryClient.getQueryData<SmartPageItem[]>(['smart-pages'])
      queryClient.setQueryData<SmartPageItem[]>(['smart-pages'], (old) =>
        (old ?? []).map((p) => (p.id === id ? { ...p, ...patch } as SmartPageItem : p))
      )
      return { previous }
    },
    onError: (err, _vars, context: unknown) => {
      const ctx = context as { previous?: SmartPageItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['smart-pages'], ctx.previous)
      toast.error(err.message || 'ذخیره تغییرات ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در ذخیره صفحه هوشمند', 'assertive')
    },
    onSuccess: () => {
      toast.success('تغییرات ذخیره شد.')
      announce('تغییرات صفحه ذخیره شد')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['smart-pages'] }),
  })

  const deleteMutation = useMutation<void, Error, SmartPageItem>({
    mutationFn: (item) => api.delete<void>(`/api/smart-pages/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['smart-pages'] })
      const previous = queryClient.getQueryData<SmartPageItem[]>(['smart-pages'])
      queryClient.setQueryData<SmartPageItem[]>(['smart-pages'], (old) =>
        (old ?? []).filter((p) => p.id !== item.id)
      )
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: SmartPageItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['smart-pages'], ctx.previous)
      toast.error(err.message || 'حذف صفحه ناموفق بود.')
      announce('خطا در حذف صفحه هوشمند', 'assertive')
    },
    onSuccess: () => {
      toast.success('صفحه حذف شد.')
      setSelectedId(null)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['smart-pages'] }),
  })

  const handleCreate = () => {
    const stamp = Date.now().toString(36).slice(-6)
    const newItem: SmartPageItem = {
      id: `optimistic-${Date.now()}`,
      workspaceId: '',
      slug: `page-${stamp}`,
      title: 'صفحه جدید',
      description: null,
      avatarUrl: null,
      blocks: [],
      isPublished: false,
      views: 0,
      clicks: 0,
      createdAt: new Date().toISOString() as unknown as Date,
      updatedAt: new Date().toISOString() as unknown as Date,
    }
    createMutation.mutate(newItem)
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={Link2}
        badge={
          <Button
            size="sm"
            className="n-focus-ring"
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            <Plus className="size-4" />
            صفحه جدید
          </Button>
        }
      >
        صفحه هوشمند
      </SectionTitle>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="کل صفحات" value={stats.total} icon={Link2} color="text-accent" />
        <StatCard
          label="منتشرشده"
          value={stats.published}
          icon={Eye}
          color="text-success"
        />
        <StatCard label="کل بازدید" value={stats.totalViews} icon={TrendingUp} color="text-info" />
        <StatCard
          label="نرخ کلیک"
          value={stats.ctr}
          suffix="٪"
          icon={MousePointerClick}
          color="text-accent"
        />
      </div>

      {/* Pages grid */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری صفحات"
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {!pages || pages.length === 0 ? (
          <div className="n-card p-10">
            <EmptyState
              icon={Link2}
              title="هنوز صفحه هوشمندی نساخته‌اید"
              message="یک صفحه لینک‌در‌بایو بسازید تا تمام لینک‌های مهم خود را در یک آدرس کوتاه جمع‌آوری کنید."
              action={
                <Button
                  size="sm"
                  className="n-focus-ring"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  <Plus className="size-4" />
                  ساخت صفحه
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {pages.map((p) => (
              <SmartPageCard
                key={p.id}
                page={p}
                onClick={() => setSelectedId(p.id)}
                onDelete={() => deleteMutation.mutate(p)}
                deleting={deleteMutation.isPending && deleteMutation.variables?.id === p.id}
              />
            ))}
          </div>
        )}
      </LoadingState>

      {/* Detail sheet */}
      <Sheet open={!!selectedId} onOpenChange={(o) => !o && setSelectedId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-xl overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="text-start">{selected.title}</SheetTitle>
                <SheetDescription className="text-start">
                  {selected.description ?? 'بدون توضیحات'}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 mt-4">
                <SmartPageDetail
                  key={selected.id}
                  page={selected}
                  onSave={(patch) => updateMutation.mutate({ id: selected.id, patch })}
                  saving={updateMutation.isPending}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  suffix,
  icon: Icon,
  color,
}: {
  label: string
  value: number
  suffix?: string
  icon: typeof Link2
  color: string
}) {
  return (
    <div className="n-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-tertiary">{label}</span>
        <Icon className={cn('size-4', color)} />
      </div>
      <p className="text-xl font-bold text-ink-primary num-tabular">
        {toPersianDigits(value)}
        {suffix}
      </p>
    </div>
  )
}

// ── Page card ────────────────────────────────────────────────────────────────

function SmartPageCard({
  page,
  onClick,
  onDelete,
  deleting,
}: {
  page: SmartPageItem
  onClick: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div className="n-card-interactive n-focus-ring p-5 text-start">
      <button onClick={onClick} className="flex w-full flex-col text-start">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink-primary truncate">{page.title}</p>
            <p dir="ltr" className="text-xs text-accent mt-0.5 truncate text-start">
              /p/{page.slug}
            </p>
          </div>
          {page.isPublished ? (
            <StatusBadge label="منتشرشده" variant="published" />
          ) : (
            <StatusBadge label="پیش‌نویس" variant="draft" />
          )}
        </div>

        <p className="text-xs text-ink-secondary line-clamp-2 mb-3 min-h-8">
          {page.description ?? '—'}
        </p>

        <div className="grid grid-cols-3 gap-2 text-center mb-2">
          <MiniStat label="بازدید" value={page.views} icon={Eye} />
          <MiniStat label="کلیک" value={page.clicks} icon={MousePointerClick} />
          <MiniStat
            label="نرخ کلیک"
            value={page.views > 0 ? Math.round((page.clicks / page.views) * 100) : 0}
            suffix="٪"
            icon={TrendingUp}
          />
        </div>
      </button>

      <Separator className="my-3" />

      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-ink-tertiary">
          {formatJalali(new Date(page.updatedAt))}
        </span>
        <div className="flex items-center gap-1">
          {page.isPublished && (
            <a
              href={publicPageUrl(page.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md text-ink-tertiary hover:bg-surface-hover hover:text-accent transition-colors"
              title="مشاهده صفحه"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3.5" />
            </a>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-ink-tertiary hover:text-danger n-focus-ring"
            title="حذف"
            disabled={deleting}
            onClick={(e) => {
              e.stopPropagation()
              if (confirm('این صفحه هوشمند حذف شود؟ این عمل قابل بازگشت نیست.')) {
                onDelete()
              }
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  suffix,
  icon: Icon,
}: {
  label: string
  value: number
  suffix?: string
  icon: typeof Link2
}) {
  return (
    <div className="rounded-lg bg-surface-subtle px-2 py-1.5">
      <Icon className="size-3 text-ink-tertiary mx-auto mb-0.5" />
      <p className="text-xs font-bold text-ink-primary num-tabular">
        {toPersianDigits(value)}
        {suffix}
      </p>
      <p className="text-2xs text-ink-tertiary">{label}</p>
    </div>
  )
}

// ── Detail sheet (editor) ────────────────────────────────────────────────────

function SmartPageDetail({
  page,
  onSave,
  saving,
}: {
  page: SmartPageItem
  onSave: (patch: Partial<SmartPageItem>) => void
  saving: boolean
}) {
  // Local editable state — synced from the canonical `page` prop when it
  // changes (e.g. after a successful mutation invalidate + refetch).
  const [title, setTitle] = useState(page.title)
  const [slug, setSlug] = useState(page.slug)
  const [description, setDescription] = useState(page.description ?? '')
  const [avatarUrl, setAvatarUrl] = useState(page.avatarUrl ?? '')
  const [blocks, setBlocks] = useState<SmartPageBlock[]>(page.blocks)
  const [isPublished, setIsPublished] = useState(page.isPublished)
  const [showQr, setShowQr] = useState(false)

  // Reset local state when the page prop identity changes (user switches
  // between pages in the list while the sheet is open). The parent renders
  // `{selected && <SmartPageDetail page={selected} key={selected.id} />}`
  // to force a clean remount per page — see the Sheet block above. The
  // `key` prop ensures useState initializers re-run with the new page.

  const ctr = page.views > 0 ? Math.round((page.clicks / page.views) * 100) : 0

  const handleSlugChange = (value: string) => {
    // Slug must be lowercase + URL-safe: a-z, 0-9, dashes.
    setSlug(value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }

  const handleAddBlock = (type: BlockType) => {
    setBlocks((prev) => [...prev, makeBlock(type)])
  }

  const handleUpdateBlock = (id: string, patch: Partial<SmartPageBlock>) => {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? ({ ...b, ...patch } as SmartPageBlock) : b))
    )
  }

  const handleRemoveBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id))
  }

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    setBlocks((prev) => {
      const next = [...prev]
      const target = direction === 'up' ? index - 1 : index + 1
      if (target < 0 || target >= next.length) return prev
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const handleSave = () => {
    if (!title.trim()) {
      toast.error('عنوان صفحه نمی‌تواند خالی باشد.')
      return
    }
    if (!slug.trim()) {
      toast.error('نامک صفحه نمی‌تواند خالی باشد.')
      return
    }
    onSave({
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim() || null,
      avatarUrl: avatarUrl.trim() || null,
      blocks,
      isPublished,
    })
  }

  const handleCopyLink = () => {
    const url = publicPageUrl(slug)
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(url).then(
        () => toast.success('لینک کپی شد.'),
        () => toast.error('کپی لینک ناموفق بود.')
      )
    }
  }

  return (
    <div className="space-y-5">
      {/* Analytics summary */}
      <div className="n-card-compact p-3">
        <div className="grid grid-cols-3 gap-2 text-center">
          <MiniStat label="بازدید" value={page.views} icon={Eye} />
          <MiniStat label="کلیک" value={page.clicks} icon={MousePointerClick} />
          <MiniStat label="نرخ کلیک" value={ctr} suffix="٪" icon={TrendingUp} />
        </div>
      </div>

      {/* Title */}
      <div>
        <Label className="mb-1.5 block text-sm font-semibold text-ink-secondary">عنوان</Label>
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: صفحه لینک من"
          className="n-focus-ring"
        />
      </div>

      {/* Slug */}
      <div>
        <Label className="mb-1.5 block text-sm font-semibold text-ink-secondary">نامک</Label>
        <div className="flex items-center gap-2">
          <span dir="ltr" className="text-xs text-ink-tertiary font-mono shrink-0">
            /p/
          </span>
          <Input
            dir="ltr"
            value={slug}
            onChange={(e) => handleSlugChange(e.target.value)}
            placeholder="my-page"
            className="n-focus-ring text-start font-mono"
          />
          <Button
            variant="outline"
            size="icon"
            className="shrink-0 n-focus-ring"
            title="کپی لینک"
            onClick={handleCopyLink}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
        <p className="mt-1 text-2xs text-ink-tertiary">
          فقط حروف انگلیسی کوچک، عدد و خط تیره.
        </p>
      </div>

      {/* Description */}
      <div>
        <Label className="mb-1.5 block text-sm font-semibold text-ink-secondary">توضیحات</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="معرفی کوتاه شما یا برندتان…"
          rows={2}
          className="n-focus-ring"
        />
      </div>

      {/* Avatar URL */}
      <div>
        <Label className="mb-1.5 block text-sm font-semibold text-ink-secondary">
          آدرس تصویر پروفایل
        </Label>
        <Input
          dir="ltr"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
          className="n-focus-ring text-start"
        />
      </div>

      <Separator />

      {/* Blocks editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-semibold text-ink-secondary">بلوک‌ها</Label>
          <Badge variant="secondary" className="text-2xs">
            {toPersianDigits(blocks.length)} بلوک
          </Badge>
        </div>

        {/* Block list */}
        <div className="space-y-2 mb-3">
          {blocks.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-6 text-center text-sm text-ink-tertiary">
              هنوز بلوکی اضافه نشده است.
            </p>
          ) : (
            blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                index={index}
                total={blocks.length}
                onChange={(patch) => handleUpdateBlock(block.id, patch)}
                onRemove={() => handleRemoveBlock(block.id)}
                onMove={(dir) => handleMoveBlock(index, dir)}
              />
            ))
          )}
        </div>

        {/* Add block picker */}
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((bt) => {
            const Icon = bt.icon
            return (
              <Button
                key={bt.type}
                variant="outline"
                size="sm"
                className="n-focus-ring"
                onClick={() => handleAddBlock(bt.type)}
              >
                <Icon className="size-3.5" />
                {bt.label}
              </Button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Publish toggle + preview */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-primary">انتشار عمومی</p>
          <p className="text-2xs text-ink-tertiary mt-0.5">
            {isPublished ? 'صفحه برای همه قابل مشاهده است.' : 'صفحه فقط برای شما قابل مشاهده است.'}
          </p>
        </div>
        <Switch
          checked={isPublished}
          onCheckedChange={setIsPublished}
          aria-label="انتشار عمومی"
        />
      </div>

      {/* QR + preview row */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="n-focus-ring"
          onClick={() => setShowQr((v) => !v)}
          disabled={!isPublished}
        >
          <QrCode className="size-3.5" />
          {showQr ? 'پنهان کردن QR' : 'نمایش QR'}
        </Button>
        <a
          href={publicPageUrl(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-surface-hover',
            !isPublished && 'pointer-events-none opacity-50'
          )}
        >
          <ExternalLink className="size-3.5" />
          مشاهده صفحه
        </a>
      </div>

      {showQr && isPublished && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border bg-surface-subtle p-4">
          <img
            src={qrCodeUrl(publicPageUrl(slug))}
            alt="QR کد صفحه"
            width={200}
            height={200}
            className="size-[200px] rounded-lg bg-white"
          />
          <p className="text-center text-2xs text-ink-tertiary">
            این QR کد را اسکن کنید تا صفحه در موبایل باز شود.
          </p>
        </div>
      )}

      <Separator />

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <a
          href={publicPageUrl(slug)}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'inline-flex items-center gap-1.5 text-xs font-medium text-ink-tertiary hover:text-accent transition-colors',
            !isPublished && 'pointer-events-none opacity-50'
          )}
        >
          <ArrowLeft className="size-3.5" />
          باز کردن صفحه
        </a>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="n-focus-ring min-w-[120px]"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
        </Button>
      </div>
    </div>
  )
}

// ── Block editor (per row) ───────────────────────────────────────────────────

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  block: SmartPageBlock
  index: number
  total: number
  onChange: (patch: Partial<SmartPageBlock>) => void
  onRemove: () => void
  onMove: (dir: 'up' | 'down') => void
}) {
  // BLOCK_TYPES covers all six block types exhaustively, but TypeScript can't
  // prove that at the call site — fall back to a default rather than `!`.
  const meta = BLOCK_TYPES.find((bt) => bt.type === block.type) ?? BLOCK_TYPES[0]
  const Icon = meta.icon

  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      {/* Header row: type label + reorder + remove */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical className="size-3.5 text-ink-tertiary shrink-0" />
          <Icon className="size-3.5 text-accent shrink-0" />
          <span className="text-xs font-semibold text-ink-primary truncate">{meta.label}</span>
          <span className="text-2xs text-ink-tertiary shrink-0">
            #{toPersianDigits(index + 1)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-ink-tertiary hover:text-ink-primary n-focus-ring disabled:opacity-30"
            title="بالا"
            disabled={index === 0}
            onClick={() => onMove('up')}
          >
            <ChevronUp className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-ink-tertiary hover:text-ink-primary n-focus-ring disabled:opacity-30"
            title="پایین"
            disabled={index === total - 1}
            onClick={() => onMove('down')}
          >
            <ChevronDown className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-6 text-ink-tertiary hover:text-danger n-focus-ring"
            title="حذف"
            onClick={onRemove}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Per-type fields */}
      <BlockFields block={block} onChange={onChange} />
    </div>
  )
}

function BlockFields({
  block,
  onChange,
}: {
  block: SmartPageBlock
  onChange: (patch: Partial<SmartPageBlock>) => void
}) {
  switch (block.type) {
    case 'link':
      return (
        <div className="grid grid-cols-1 gap-2">
          <Input
            value={block.label}
            onChange={(e) => onChange({ label: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="برچسب لینک"
            className="n-focus-ring h-8 text-sm"
          />
          <Input
            dir="ltr"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="https://…"
            className="n-focus-ring h-8 text-sm text-start"
          />
        </div>
      )

    case 'social':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Select
            value={block.platform}
            onValueChange={(v) => onChange({ platform: v } as Partial<SmartPageBlock>)}
          >
            <SelectTrigger className="n-focus-ring h-8 text-sm">
              <SelectValue placeholder="پلتفرم" />
            </SelectTrigger>
            <SelectContent>
              {SOCIAL_PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={block.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="برچسب دلخواه (اختیاری)"
            className="n-focus-ring h-8 text-sm"
          />
          <Input
            dir="ltr"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="https://…"
            className="n-focus-ring h-8 text-sm text-start sm:col-span-2"
          />
        </div>
      )

    case 'heading':
      return (
        <Input
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<SmartPageBlock>)}
          placeholder="متن عنوان"
          className="n-focus-ring h-8 text-sm"
        />
      )

    case 'text':
      return (
        <Textarea
          value={block.text}
          onChange={(e) => onChange({ text: e.target.value } as Partial<SmartPageBlock>)}
          placeholder="متن دلخواه"
          rows={2}
          className="n-focus-ring text-sm"
        />
      )

    case 'image':
      return (
        <div className="grid grid-cols-1 gap-2">
          <Input
            dir="ltr"
            value={block.url}
            onChange={(e) => onChange({ url: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="https://… (آدرس تصویر)"
            className="n-focus-ring h-8 text-sm text-start"
          />
          <Input
            value={block.alt}
            onChange={(e) => onChange({ alt: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="متن جایگزین (alt)"
            className="n-focus-ring h-8 text-sm"
          />
          <Input
            value={block.caption ?? ''}
            onChange={(e) => onChange({ caption: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="کپشن (اختیاری)"
            className="n-focus-ring h-8 text-sm"
          />
        </div>
      )

    case 'latest-posts':
      return (
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            max={20}
            value={block.limit}
            onChange={(e) =>
              onChange({ limit: Math.max(1, Math.min(20, Number(e.target.value) || 1)) } as Partial<SmartPageBlock>)
            }
            placeholder="تعداد"
            className="n-focus-ring h-8 text-sm"
          />
          <Input
            value={block.label ?? ''}
            onChange={(e) => onChange({ label: e.target.value } as Partial<SmartPageBlock>)}
            placeholder="عنوان بخش (اختیاری)"
            className="n-focus-ring h-8 text-sm"
          />
        </div>
      )

    default:
      return null
  }
}
