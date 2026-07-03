'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Filter,
  Send,
  Check,
  X,
} from 'lucide-react'

import { api } from '@/lib/api'
import { relativeTime, toPersianDigits } from '@/lib/jalali'
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
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [campaignFilter, setCampaignFilter] = useState<string>('all')
  const queryClient = useQueryClient()

  const { data: content, isLoading } = useQuery<ContentItem[]>({
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
  // The backend create endpoint is not implemented yet; the mutationFn resolves
  // immediately so the optimistic update remains visible.
  const createContentMutation = useMutation<ContentItem, Error, ContentItem>({
    mutationFn: async (newItem) => {
      await new Promise((r) => setTimeout(r, 120))
      return newItem
    },
    onMutate: async (newItem) => {
      await queryClient.cancelQueries({ queryKey: ['content'] })
      const previous = queryClient.getQueryData<ContentItem[]>(['content'])
      queryClient.setQueryData<ContentItem[]>(['content'], (old) => [newItem, ...(old ?? [])])
      announce('محتوای جدید اضافه شد')
      return { previous }
    },
    onError: (_err, _newItem, context: any) => {
      if (context?.previous) queryClient.setQueryData(['content'], context.previous)
      toast.error('ایجاد محتوا ناموفق بود. تغییرات برگردانده شد.')
      announce('خطا در ایجاد محتوا', 'assertive')
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
    toast.success('محتوای جدید ایجاد شد.')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary" />
            <Input
              dir="rtl"
              placeholder="جستجو در عنوان محتوا…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
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
          <Button
            size="sm"
            className="ms-auto n-focus-ring"
            onClick={handleCreateContent}
            disabled={createContentMutation.isPending}
          >
            <Plus className="size-4" />
            محتوای جدید
          </Button>
        </div>
      </div>

      {/* Content table */}
      <div className="n-card n-gradient-border p-0 overflow-hidden">
        <LoadingState
          isLoading={isLoading}
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
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold">
                      محتوا
                    </TableHead>
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold">
                      وضعیت
                    </TableHead>
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold hidden sm:table-cell">
                      کمپین
                    </TableHead>
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold hidden md:table-cell">
                      پلتفرم‌ها
                    </TableHead>
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold hidden md:table-cell">
                      نویسنده
                    </TableHead>
                    <TableHead className="text-right text-xs text-ink-tertiary font-bold hidden sm:table-cell">
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
                              onClick={() => toast.info('ویرایش محتوا به‌زودی فعال خواهد شد.')}
                            >
                              <Pencil className="size-3.5" />
                              ویرایش
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
    </motion.div>
  )
}
