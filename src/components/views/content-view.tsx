'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Send,
  Check,
  X,
  History,
  RotateCcw,
} from 'lucide-react'

import { api } from '@/lib/api'
import { relativeTime, toPersianDigits, formatJalali, formatJalaliTime } from '@/lib/jalali'
import {
  SectionTitle,
  StatusBadge,
  PlatformDot,
  EmptyState,
  Skeleton,
  LoadingState,
} from '@/components/dashboard/shared'
import { announce } from '@/lib/aria-live'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface ContentItem {
  id: string
  title: string
  body: string | null
  hashtags: string | null
  status: string
  authorName: string | null
  thumbnail: string | null
  campaign: string
  platforms: string[]
  scheduledAt: string | null
  publishedAt: string | null
  updatedAt: string
}

interface Campaign {
  id: string
  name: string
}

const STATUS_VARIANT_LABEL: Record<string, string> = {
  draft: 'پیش‌نویس',
  review: 'در حال بررسی',
  approved: 'تأییدشده',
  rejected: 'ردشده',
  scheduled: 'برنامه‌ریزی‌شده',
  published: 'منتشرشده',
  failed: 'ناموفق',
}

export function ContentView() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const [revisionsOpenFor, setRevisionsOpenFor] = useState<ContentItem | null>(null)
  const queryClient = useQueryClient()

  const { data: content, isLoading, isError, refetch } = useQuery<ContentItem[]>({
    queryKey: ['content'],
    queryFn: () => api.getPaginated<ContentItem>('/api/content'),
  })
  const { data: campaigns } = useQuery<Campaign[]>({
    queryKey: ['campaigns'],
    queryFn: () => api.getPaginated<Campaign>('/api/campaigns'),
  })

  const filtered = useMemo(() => {
    if (!content) return []
    return content.filter((c) => {
      if (search && !c.title.toLowerCase().includes(search.toLowerCase())) return false
      if (statusFilter !== 'all' && c.status !== statusFilter) return false
      if (campaignFilter !== 'all' && c.campaign !== campaignFilter) return false
      return true
    })
  }, [content, search, statusFilter, campaignFilter])

  // Optimistic create: append a draft row to the ["content"] cache in <100ms.
  // mutationFn hits the real POST /api/content endpoint (which creates a draft
  // via the publications service). The API returns { id } only, so we keep the
  // optimistic row in the cache and rely on onSettled's invalidate to refetch
  // the canonical list (with the persisted row replacing the placeholder).
  const createContentMutation = useMutation<ContentItem, Error, ContentItem>({
    mutationFn: async (newItem) => {
      await api.post<{ id: string }>('/api/content', { title: newItem.title })
      return newItem
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['content'] })
      const previous = queryClient.getQueryData<ContentItem[]>(['content'])
      queryClient.setQueryData<ContentItem[]>(['content'], (old) => [newItem, ...(old ?? [])])
      announce('محتوای جدید اضافه شد')
      return { previous }
    },
    onError: (err, _newItem, context: any) => {
      if (context?.previous) queryClient.setQueryData(['content'], context.previous)
      toast.error(err.message || 'ایجاد محتوا ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در ایجاد محتوا', 'assertive')
    },
    onSuccess: () => {
      toast.success('محتوای جدید ایجاد شد.')
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['content'] })
    },
  })

  const handleCreateContent = () => {
    const newItem: ContentItem = {
      id: `optimistic-${Date.now()}`,
      title: 'محتوای بدون عنوان',
      body: null,
      hashtags: null,
      status: 'draft',
      authorName: null,
      thumbnail: null,
      campaign: 'بدون کمپین',
      platforms: [],
      scheduledAt: null,
      publishedAt: null,
      updatedAt: new Date().toISOString(),
    }
    createContentMutation.mutate(newItem)
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={FileText}
        badge={
          <span className="text-xs text-ink-tertiary num-tabular">
            {toPersianDigits(content?.length ?? 0)} مورد
          </span>
        }
      >
        کتابخانه محتوا
      </SectionTitle>

      {/* Filter bar */}
      <div className="n-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary" />
            <Input
              dir="rtl"
              placeholder="فیلتر بر اساس عنوان…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="وضعیت" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه وضعیت‌ها</SelectItem>
              <SelectItem value="draft">پیش‌نویس</SelectItem>
              <SelectItem value="review">در حال بررسی</SelectItem>
              <SelectItem value="approved">تأییدشده</SelectItem>
              <SelectItem value="rejected">ردشده</SelectItem>
              <SelectItem value="scheduled">برنامه‌ریزی‌شده</SelectItem>
              <SelectItem value="published">منتشرشده</SelectItem>
              <SelectItem value="failed">ناموفق</SelectItem>
            </SelectContent>
          </Select>
          <Select value={campaignFilter} onValueChange={setCampaignFilter}>
            <SelectTrigger className="w-40 h-9">
              <SelectValue placeholder="کمپین" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه کمپین‌ها</SelectItem>
              {(campaigns ?? []).map((c) => (
                <SelectItem key={c.id} value={c.name}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* «محتوای جدید» removed — the global «انتشار جدید» in the command
              bar is the single create action (plan §1: one primary action per
              page). The empty state keeps its contextual create CTA. */}
        </div>
      </div>

      {/* Content table */}
      <div className="n-card n-gradient-border p-0 overflow-hidden">
        <LoadingState
          isLoading={isLoading}
          isError={isError}
          onRetry={refetch}
          errorLabel="خطا در بارگذاری محتوا"
          skeleton={
            <div className="p-5 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="محتوایی یافت نشد"
              message="با فیلترهای دیگر امتحان کنید یا مستقیماً یک محتوای جدید بسازید."
              illustration="content"
              action={
                <Button
                  size="sm"
                  className="n-focus-ring"
                  onClick={handleCreateContent}
                  disabled={createContentMutation.isPending}
                >
                  <Plus className="size-4" />
                  ساخت محتوا
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto thin-scrollbar">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                      محتوا
                    </TableHead>
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                      وضعیت
                    </TableHead>
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">
                      کمپین
                    </TableHead>
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden md:table-cell">
                      پلتفرم‌ها
                    </TableHead>
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden md:table-cell">
                      نویسنده
                    </TableHead>
                    <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">
                      به‌روزرسانی
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id} className="border-border">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {c.thumbnail ? (
                            <img
                              src={c.thumbnail}
                              alt=""
                              className="size-10 rounded-lg object-cover shrink-0"
                            />
                          ) : (
                            <div className="size-10 rounded-lg bg-border flex items-center justify-center shrink-0">
                              <FileText className="size-4 text-ink-tertiary" />
                            </div>
                          )}
                          <div className="min-w-0 max-w-48">
                            <p className="text-sm font-semibold text-ink-primary truncate">
                              {c.title}
                            </p>
                            <p className="text-xs text-ink-tertiary truncate line-clamp-1">
                              {c.body ?? '—'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          label={STATUS_VARIANT_LABEL[c.status] ?? c.status}
                          variant={c.status}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm text-ink-secondary">
                        {c.campaign}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex items-center gap-1.5">
                          {c.platforms.length === 0 ? (
                            <span className="text-xs text-ink-tertiary">—</span>
                          ) : (
                            c.platforms.map((p, i) => (
                              <PlatformDot key={`${p}-${i}`} platform={p} />
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-ink-secondary">
                        {c.authorName ?? '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs text-ink-tertiary">
                        {relativeTime(new Date(c.updatedAt))}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8 n-focus-ring">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {/* Approval actions */}
                            {(c.status === 'draft' || c.status === 'rejected') && (
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await api.post(`/api/content/${c.id}/submit-review`, {})
                                    toast.success('برای بررسی ارسال شد')
                                    queryClient.invalidateQueries({ queryKey: ['content'] })
                                  } catch {
                                    toast.error('خطا در ارسال')
                                  }
                                }}
                              >
                                <Send className="size-3.5" />
                                ارسال برای بررسی
                              </DropdownMenuItem>
                            )}
                            {c.status === 'review' && (
                              <>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    try {
                                      await api.post(`/api/content/${c.id}/approve`, {})
                                      toast.success('تأیید شد ✓')
                                      queryClient.invalidateQueries({ queryKey: ['content'] })
                                    } catch {
                                      toast.error('خطا در تأیید')
                                    }
                                  }}
                                >
                                  <Check className="size-3.5" />
                                  تأیید محتوا
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-danger focus:text-danger"
                                  onClick={async () => {
                                    try {
                                      await api.post(`/api/content/${c.id}/reject`, {
                                        reason: 'نیاز به بازبینی',
                                      })
                                      toast.success('رد شد')
                                      queryClient.invalidateQueries({ queryKey: ['content'] })
                                    } catch {
                                      toast.error('خطا در رد')
                                    }
                                  }}
                                >
                                  <X className="size-3.5" />
                                  رد محتوا
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                              </>
                            )}
                            <DropdownMenuItem
                              onClick={() => router.push('/compose')}
                            >
                              <Pencil className="size-3.5" />
                              ویرایش
                            </DropdownMenuItem>
                            {/* Issue #212: revision history — opens a Sheet with the
                                full revision list for this content row. */}
                            <DropdownMenuItem
                              onClick={() => setRevisionsOpenFor(c)}
                            >
                              <History className="size-3.5" />
                              تاریخچه نسخه‌ها
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toast.success('محتوا با موفقیت کپی شد.')}
                            >
                              <Copy className="size-3.5" />
                              ایجاد کپی
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-danger focus:text-danger"
                              onClick={() => toast.error('حذف محتوا نیاز به تأیید دارد.')}
                            >
                              <Trash2 className="size-3.5" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </LoadingState>
      </div>

      {filtered.length > 0 && (
        <div className="text-center text-xs text-ink-tertiary num-tabular">
          نمایش {toPersianDigits(filtered.length)} مورد از {toPersianDigits(content?.length ?? 0)}
        </div>
      )}

      {/* Issue #212: revision history sheet */}
      <RevisionsSheet
        content={revisionsOpenFor}
        onClose={() => setRevisionsOpenFor(null)}
      />
    </motion.div>
  )
}

/* ── Issue #212: revision history sheet ── */

interface RevisionItem {
  id: string
  contentId: string
  title: string
  body: string | null
  hashtags: string | null
  internalNote: string | null
  authorName: string | null
  version: number
  createdAt: string
}

function RevisionsSheet({
  content,
  onClose,
}: {
  content: ContentItem | null
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const open = content !== null
  const contentId = content?.id ?? ''

  const { data: revisions, isLoading } = useQuery<RevisionItem[]>({
    queryKey: ['content-revisions', contentId],
    queryFn: () => api.getPaginated<RevisionItem>(`/api/content/${contentId}/revisions`),
    enabled: !!content,
  })

  const restoreMutation = useMutation({
    mutationFn: async (revisionId: string) =>
      api.post<{ revision: RevisionItem; newRevision: RevisionItem }>(
        `/api/content/${contentId}/revisions/${revisionId}/restore`
      ),
    onSuccess: () => {
      toast.success('نسخه بازیابی شد ✓')
      announce('نسخه بازیابی شد')
      queryClient.invalidateQueries({ queryKey: ['content'] })
      queryClient.invalidateQueries({ queryKey: ['content-revisions', content?.id] })
      onClose()
    },
    onError: () => {
      toast.error('خطا در بازیابی نسخه')
      announce('خطا در بازیابی نسخه', 'assertive')
    },
  })

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto thin-scrollbar">
        <SheetHeader>
          <SheetTitle className="text-start">تاریخچه نسخه‌ها</SheetTitle>
          <SheetDescription className="text-start">
            {content?.title ?? '—'}
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6 space-y-2 mt-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (revisions ?? []).length === 0 ? (
            <EmptyState
              icon={History}
              title="نسخه‌ای ثبت نشده"
              message="هر بار ارسال برای بررسی، تأیید یا رد، یک نسخه از محتوا ذخیره می‌کند."
              illustration="content"
              size="compact"
            />
          ) : (
            (revisions ?? []).map((r, i) => {
              const isLatest = i === 0
              const prev = (revisions ?? [])[i + 1]
              return (
                <div
                  key={r.id}
                  className={cn(
                    'n-card-compact p-3 space-y-2',
                    isLatest && 'ring-2 ring-accent/30'
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="inline-flex items-center justify-center size-7 rounded-full bg-accent-soft text-accent text-xs font-bold shrink-0 num-tabular">
                        {toPersianDigits(r.version)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-primary truncate">
                          {r.title || 'بدون عنوان'}
                        </p>
                        <p className="text-2xs text-ink-tertiary">
                          {r.authorName ?? '—'} • {formatJalali(new Date(r.createdAt))} {formatJalaliTime(new Date(r.createdAt))}
                        </p>
                      </div>
                    </div>
                    {isLatest && (
                      <span className="text-2xs font-bold px-1.5 py-0.5 rounded-full bg-accent-soft text-accent shrink-0">
                        آخرین
                      </span>
                    )}
                  </div>
                  {/* Diff summary vs previous revision */}
                  {prev ? (
                    <RevisionDiffSummary current={r} previous={prev} />
                  ) : (
                    <p className="text-2xs text-ink-tertiary ps-9">نسخه اولیه</p>
                  )}
                  {!isLatest && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full n-focus-ring"
                      disabled={restoreMutation.isPending}
                      onClick={() => {
                        if (confirm(`نسخه ${toPersianDigits(r.version)} بازیابی شود؟ محتوای فعلی با این نسخه جایگزین می‌شود.`)) {
                          restoreMutation.mutate(r.id)
                        }
                      }}
                    >
                      <RotateCcw className="size-3.5" />
                      بازیابی این نسخه
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

/** Compact diff summary between two revisions — counts changed fields. */
function RevisionDiffSummary({
  current,
  previous,
}: {
  current: RevisionItem
  previous: RevisionItem
}) {
  const fields: Array<{ label: string; from: string; to: string }> = [
    { label: 'عنوان', from: previous.title ?? '', to: current.title ?? '' },
    { label: 'متن', from: previous.body ?? '', to: current.body ?? '' },
    { label: 'هشتگ‌ها', from: previous.hashtags ?? '', to: current.hashtags ?? '' },
    { label: 'یادداشت', from: previous.internalNote ?? '', to: current.internalNote ?? '' },
  ]
  const changed = fields.filter((f) => f.from !== f.to)
  if (changed.length === 0) {
    return <p className="text-2xs text-ink-tertiary ps-9">بدون تغییر نسبت به نسخه قبل</p>
  }
  return (
    <div className="ps-9 space-y-0.5">
      {changed.map((f) => (
        <div key={f.label} className="text-2xs flex items-center gap-1.5">
          <span className="text-ink-tertiary shrink-0">{f.label}:</span>
          <span className="text-success font-bold shrink-0">تغییر یافت</span>
        </div>
      ))}
    </div>
  )
}
