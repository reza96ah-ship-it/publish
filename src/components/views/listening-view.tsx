'use client'

/**
 * Issue #251: Social listening foundation + spike alerts — admin view (`/listening`).
 *
 * Client component following the automations-view + smart-pages-view pattern:
 *  - useQuery(['listening']) lists saved searches via api.getPaginated
 *  - useMutation for create / update / delete / toggle / detect-spike with
 *    optimistic updates + rollback
 *  - LoadingState + EmptyState + SkeletonCard for loading / empty / error
 *  - Create <Dialog> with name / keywords / provider checkboxes / language
 *    checkboxes / spike-alert config / coverage notes textarea
 *  - Mentions <Sheet> with cursor-paginated chronological list + filters
 *    (spike / sentiment / language)
 *  - Honest coverage disclosure banner on every surface (#251 requirement)
 *  - verifiedSentiment-only badges — autoSentiment is NEVER shown (#251)
 *  - pageTransition + pageTransitionProps for view enter animation
 *  - toast + announce() for accessibility
 *  - toPersianDigits + formatJalali + relativeTime
 */

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Radar,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Share2,
  Zap,
  Activity,
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  Heart,
  Repeat2,
  Globe,
  Filter,
  Sparkles,
  RefreshCw,
  Info,
} from 'lucide-react'

import { api } from '@/lib/api'
import { isPlatformEnabled } from '@/lib/provider-capabilities'
import { toPersianDigits, formatJalali, relativeTime } from '@/lib/jalali'
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
import { Checkbox } from '@/components/ui/checkbox'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type {
  ListeningQueryItem,
  ListeningMentionItem,
  MentionListResult,
  SpikeAlert,
} from '@/modules/listening'

// ── Type metadata ────────────────────────────────────────────────────────────

const PROVIDER_LABELS: Record<string, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  linkedin: 'لینکدین',
  rubika: 'روبیکا',
  bale: 'بله',
  eitaa: 'ایتا',
}

const PROVIDER_OPTIONS = ['instagram', 'telegram', 'linkedin', 'rubika', 'bale', 'eitaa'].filter(
  isPlatformEnabled,
)

const LANGUAGE_LABELS: Record<string, string> = {
  fa: 'فارسی',
  en: 'انگلیسی',
  ar: 'عربی',
}

const LANGUAGE_OPTIONS = ['fa', 'en', 'ar']

const SENTIMENT_LABELS: Record<string, string> = {
  positive: 'مثبت',
  neutral: 'خنثی',
  negative: 'منفی',
}

const SENTIMENT_VARIANT: Record<string, string> = {
  positive: 'published',
  neutral: 'draft',
  negative: 'high',
}

const DEFAULT_COVERAGE_BANNER =
  'پوشش محدود است: فقط کامنت‌های اینستاگرام — دایرکت‌ها، استوری‌ها و پیام‌های خصوصی از طریق API قابل دسترسی نیستند.'

// ── View ─────────────────────────────────────────────────────────────────────

export function ListeningView() {
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [mentionsQueryId, setMentionsQueryId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { data: queries, isLoading, isError, refetch } = useQuery<ListeningQueryItem[]>({
    queryKey: ['listening'],
    queryFn: () => api.getPaginated<ListeningQueryItem>('/api/listening'),
  })

  const editing = queries?.find((q) => q.id === editingId) ?? null
  const mentionsQuery = queries?.find((q) => q.id === mentionsQueryId) ?? null

  const stats = useMemo(() => {
    const total = queries?.length ?? 0
    const active = queries?.filter((q) => q.isActive).length ?? 0
    const spikeEnabled = queries?.filter((q) => q.spikeAlertEnabled).length ?? 0
    const providersCovered = new Set(
      queries?.flatMap((q) => q.providers) ?? []
    ).size
    return { total, active, spikeEnabled, providersCovered }
  }, [queries])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation<ListeningQueryItem, Error, Partial<ListeningQueryItem>>({
    mutationFn: (input) =>
      api.post<ListeningQueryItem>('/api/listening', {
        name: input.name ?? 'جستجوی جدید',
        keywords: input.keywords ?? [],
        languages: input.languages ?? [],
        providers: input.providers ?? ['instagram'],
        spikeAlertEnabled: input.spikeAlertEnabled ?? true,
        spikeThreshold: input.spikeThreshold ?? 3.0,
        coverageNotes: input.coverageNotes ?? '',
      }),
    onSuccess: () => {
      toast.success('جستجوی گوش‌دادن جدید ایجاد شد.')
      announce('جستجوی گوش‌دادن جدید ایجاد شد')
      setShowCreate(false)
    },
    onError: (err) => {
      toast.error(err.message || 'ایجاد جستجو ناموفق بود.')
      announce('خطا در ایجاد جستجو', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listening'] }),
  })

  const updateMutation = useMutation<
    ListeningQueryItem,
    Error,
    { id: string; patch: Partial<ListeningQueryItem> }
  >({
    mutationFn: ({ id, patch }) => api.patch<ListeningQueryItem>(`/api/listening/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['listening'] })
      const previous = queryClient.getQueryData<ListeningQueryItem[]>(['listening'])
      queryClient.setQueryData<ListeningQueryItem[]>(['listening'], (old) =>
        (old ?? []).map((q) => (q.id === id ? ({ ...q, ...patch } as ListeningQueryItem) : q))
      )
      return { previous }
    },
    onError: (err, _vars, context: unknown) => {
      const ctx = context as { previous?: ListeningQueryItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['listening'], ctx.previous)
      toast.error(err.message || 'ذخیره تغییرات ناموفق بود.')
      announce('خطا در ذخیره جستجو', 'assertive')
    },
    onSuccess: () => {
      toast.success('تغییرات ذخیره شد.')
      announce('تغییرات جستجو ذخیره شد')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listening'] }),
  })

  const deleteMutation = useMutation<void, Error, ListeningQueryItem>({
    mutationFn: (item) => api.delete<void>(`/api/listening/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['listening'] })
      const previous = queryClient.getQueryData<ListeningQueryItem[]>(['listening'])
      queryClient.setQueryData<ListeningQueryItem[]>(['listening'], (old) =>
        (old ?? []).filter((q) => q.id !== item.id)
      )
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: ListeningQueryItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['listening'], ctx.previous)
      toast.error(err.message || 'حذف جستجو ناموفق بود.')
      announce('خطا در حذف جستجو', 'assertive')
    },
    onSuccess: () => {
      toast.success('جستجو حذف شد.')
      setEditingId(null)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['listening'] }),
  })

  const detectSpikeMutation = useMutation<SpikeAlert, Error, ListeningQueryItem>({
    mutationFn: (item) => api.post<SpikeAlert>(`/api/listening/${item.id}/detect-spike`),
    onSuccess: (data, item) => {
      toast.success(
        `تشخیص اسپایک انجام شد — ${toPersianDigits(data.spikeCount)} کامنت پررنگ شد.`
      )
      announce(
        `تشخیص اسپایک برای ${item.name} انجام شد. ${toPersianDigits(data.spikeCount)} مورد پررنگ شد.`,
        'assertive'
      )
      queryClient.invalidateQueries({ queryKey: ['listening-mentions', item.id] })
    },
    onError: (err) => {
      toast.error(err.message || 'تشخیص اسپایک ناموفق بود.')
      announce('خطا در تشخیص اسپایک', 'assertive')
    },
  })

  const handleShare = async (item: ListeningQueryItem) => {
    if (!item.shareToken) {
      toast.error('این جستجو لینک اشتراک ندارد.')
      return
    }
    const url = `${window.location.origin}/api/listening/shared/${item.shareToken}`
    try {
      await navigator.clipboard.writeText(url)
      toast.success('لینک اشتراک کپی شد.')
      announce('لینک اشتراک کپی شد')
    } catch {
      toast.error('کپی لینک ناموفق بود.')
    }
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={Radar}
        badge={
          <Button
            size="sm"
            className="n-focus-ring"
            onClick={() => setShowCreate(true)}
          >
            <Plus className="size-4" />
            ایجاد جستجوی جدید
          </Button>
        }
      >
        گوش‌دادن اجتماعی
      </SectionTitle>

      {/* Coverage disclosure banner (#251 — honest transparency) */}
      <div className="n-card flex items-start gap-3 border-info/30 bg-info-soft/30 p-4">
        <Info className="size-5 shrink-0 text-info mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-info">پوشش داده‌ها</p>
          <p className="text-2xs text-ink-secondary mt-1 leading-relaxed">
            {DEFAULT_COVERAGE_BANNER}
          </p>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="کل جستجوها" value={stats.total} icon={Radar} color="text-accent" />
        <StatCard label="فعال" value={stats.active} icon={Activity} color="text-success" />
        <StatCard
          label="هشدار اسپایک"
          value={stats.spikeEnabled}
          icon={Zap}
          color="text-warning"
        />
        <StatCard
          label="پلتفرم‌ها"
          value={stats.providersCovered}
          icon={Globe}
          color="text-info"
        />
      </div>

      {/* Queries grid */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری جستجوها"
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {!queries || queries.length === 0 ? (
          <div className="n-card p-10">
            <EmptyState
              icon={Radar}
              title="هنوز جستجوی گوش‌دادنی نساخته‌اید"
              message="با ساخت جستجو می‌توانید نام برند، رقبا یا هشتگ‌ها را در اینستاگرام دنبال کنید و هشدار اسپایک دریافت کنید."
              action={
                <Button
                  size="sm"
                  className="n-focus-ring"
                  onClick={() => setShowCreate(true)}
                >
                  <Plus className="size-4" />
                  ایجاد جستجوی جدید
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {queries.map((q) => (
              <ListeningQueryCard
                key={q.id}
                query={q}
                onEdit={() => setEditingId(q.id)}
                onDelete={() => deleteMutation.mutate(q)}
                onToggleActive={(v) =>
                  updateMutation.mutate({ id: q.id, patch: { isActive: v } })
                }
                onViewMentions={() => setMentionsQueryId(q.id)}
                onShare={() => handleShare(q)}
                onDetectSpike={() => detectSpikeMutation.mutate(q)}
                deleting={
                  deleteMutation.isPending && deleteMutation.variables?.id === q.id
                }
                spiking={
                  detectSpikeMutation.isPending &&
                  detectSpikeMutation.variables?.id === q.id
                }
              />
            ))}
          </div>
        )}
      </LoadingState>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-start">ایجاد جستجوی گوش‌دادن</DialogTitle>
            <DialogDescription className="text-start">
              کلمات کلیدی، پلتفرم‌ها و تنظیمات هشدار اسپایک را تعیین کنید.
            </DialogDescription>
          </DialogHeader>
          <QueryForm
            mode="create"
            onSubmit={(data) => createMutation.mutate(data)}
            onCancel={() => setShowCreate(false)}
            submitting={createMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Edit sheet */}
      <Sheet open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="text-start">{editing.name}</SheetTitle>
                <SheetDescription className="text-start">
                  ویرایش کلمات کلیدی، پلتفرم‌ها و تنظیمات هشدار اسپایک.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 mt-4">
                <QueryForm
                  mode="edit"
                  initial={editing}
                  onSubmit={(data) =>
                    updateMutation.mutate({ id: editing.id, patch: data })
                  }
                  onCancel={() => setEditingId(null)}
                  submitting={updateMutation.isPending}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Mentions sheet */}
      <Sheet
        open={!!mentionsQueryId}
        onOpenChange={(o) => !o && setMentionsQueryId(null)}
      >
        <SheetContent side="left" className="w-full sm:max-w-3xl overflow-y-auto">
          {mentionsQuery && (
            <>
              <SheetHeader>
                <SheetTitle className="text-start">{mentionsQuery.name}</SheetTitle>
                <SheetDescription className="text-start">
                  فهرست کامنت‌های اخیر — به ترتیب زمان.
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 mt-4">
                <MentionsList queryId={mentionsQuery.id} query={mentionsQuery} />
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
  icon: Icon,
  color,
}: {
  label: string
  value: number
  icon: typeof Radar
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
      </p>
    </div>
  )
}

// ── Listening query card ─────────────────────────────────────────────────────

function ListeningQueryCard({
  query,
  onEdit,
  onDelete,
  onToggleActive,
  onViewMentions,
  onShare,
  onDetectSpike,
  deleting,
  spiking,
}: {
  query: ListeningQueryItem
  onEdit: () => void
  onDelete: () => void
  onToggleActive: (v: boolean) => void
  onViewMentions: () => void
  onShare: () => void
  onDetectSpike: () => void
  deleting: boolean
  spiking: boolean
}) {
  // Lazy-load mention count via the cursor-paginated mentions endpoint.
  // We request limit=1 and check if nextCursor is set (meaning ≥1 mention).
  // For a true count we'd need a /count endpoint; here we just show the
  // first-page length and "+" if more exist.
  const { data: mentionPreview } = useQuery<MentionListResult>({
    queryKey: ['listening-mentions-preview', query.id],
    queryFn: () =>
      api.get<MentionListResult>(
        `/api/listening/${query.id}/mentions?limit=100`
      ),
    staleTime: 60_000,
  })

  const mentionCount = mentionPreview?.data.length ?? 0
  const hasMore = !!mentionPreview?.nextCursor

  return (
    <div className="n-card-interactive n-focus-ring p-5 text-start">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-ink-primary truncate">
            {query.name}
          </p>
          <p className="text-xs text-ink-tertiary mt-0.5">
            {query.spikeAlertEnabled
              ? `هشدار اسپایک فعال · آستانه ${toPersianDigits(query.spikeThreshold)}σ`
              : 'بدون هشدار اسپایک'}
          </p>
        </div>
        {query.isActive ? (
          <StatusBadge label="فعال" variant="published" />
        ) : (
          <StatusBadge label="متوقف" variant="draft" />
        )}
      </div>

      {/* Keywords chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {query.keywords.slice(0, 5).map((kw, i) => (
          <span
            key={`${kw}-${i}`}
            className="inline-flex items-center rounded-md bg-surface-hover px-2 py-0.5 text-2xs font-medium text-ink-secondary"
          >
            {kw}
          </span>
        ))}
        {query.keywords.length > 5 && (
          <span className="text-2xs text-ink-tertiary">
            +{toPersianDigits(query.keywords.length - 5)}
          </span>
        )}
      </div>

      {/* Provider badges */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {query.providers.map((p) => (
          <MiniChip
            key={p}
            icon={Globe}
            label={PROVIDER_LABELS[p] ?? p}
          />
        ))}
        <MiniChip
          icon={MessageCircle}
          label={
            hasMore
              ? `${toPersianDigits(mentionCount)}+ کامنت`
              : `${toPersianDigits(mentionCount)} کامنت`
          }
        />
      </div>

      {/* Coverage notes (truncated) */}
      {query.coverageNotes && (
        <p className="text-2xs text-ink-tertiary line-clamp-2 mb-3 min-h-4 leading-relaxed">
          {query.coverageNotes}
        </p>
      )}

      <Separator className="my-3" />

      {/* Active toggle + last checked */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <label className="flex items-center gap-2 text-2xs text-ink-secondary">
          <Switch
            checked={query.isActive}
            onCheckedChange={onToggleActive}
            aria-label="فعال/غیرفعال"
          />
          {query.isActive ? 'فعال' : 'متوقف'}
        </label>
        <span className="text-2xs text-ink-tertiary">
          {query.lastCheckedAt
            ? `آخرین بررسی: ${relativeTime(new Date(query.lastCheckedAt))}`
            : 'بررسی نشده'}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={onViewMentions}
        >
          <Eye className="size-3.5" />
          کامنت‌ها
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={onDetectSpike}
          disabled={spiking || !query.spikeAlertEnabled}
          title="تشخیص اسپایک"
        >
          <RefreshCw className={cn('size-3.5', spiking && 'animate-spin')} />
          اسپایک
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={onShare}
          title="کپی لینک اشتراک"
        >
          <Share2 className="size-3.5" />
          اشتراک
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="n-focus-ring ms-auto"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="n-focus-ring text-danger hover:bg-danger-soft hover:text-danger"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function MiniChip({ icon: Icon, label }: { icon: typeof Radar; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-2xs font-medium text-ink-secondary">
      <Icon className="size-3" />
      {label}
    </span>
  )
}

// ── Create / Edit form (shared) ─────────────────────────────────────────────

function QueryForm({
  mode,
  initial,
  onSubmit,
  onCancel,
  submitting,
}: {
  mode: 'create' | 'edit'
  initial?: ListeningQueryItem
  onSubmit: (data: Partial<ListeningQueryItem>) => void
  onCancel: () => void
  submitting: boolean
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [keywordsText, setKeywordsText] = useState(
    initial?.keywords.join('، ') ?? ''
  )
  const [providers, setProviders] = useState<string[]>(
    initial?.providers ?? ['instagram']
  )
  const [languages, setLanguages] = useState<string[]>(initial?.languages ?? [])
  const [spikeAlertEnabled, setSpikeAlertEnabled] = useState(
    initial?.spikeAlertEnabled ?? true
  )
  const [spikeThreshold, setSpikeThreshold] = useState(
    initial?.spikeThreshold ?? 3.0
  )
  const [coverageNotes, setCoverageNotes] = useState(
    initial?.coverageNotes ?? ''
  )

  const toggleProvider = (p: string) => {
    setProviders((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const toggleLanguage = (l: string) => {
    setLanguages((prev) =>
      prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l]
    )
  }

  const handleSubmit = () => {
    const keywords = keywordsText
      .split(/[،,\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
    if (!name.trim()) {
      toast.error('نام جستجو الزامی است')
      return
    }
    if (keywords.length === 0) {
      toast.error('حداقل یک کلمه کلیدی الزامی است')
      return
    }
    if (providers.length === 0) {
      toast.error('حداقل یک پلتفرم باید انتخاب شود')
      return
    }
    onSubmit({
      name,
      keywords,
      languages,
      providers,
      spikeAlertEnabled,
      spikeThreshold,
      ...(coverageNotes.trim() ? { coverageNotes } : {}),
    })
  }

  return (
    <div className="space-y-4 px-1">
      {/* Name */}
      <div>
        <Label htmlFor="lq-name" className="text-xs text-ink-tertiary">
          نام جستجو
        </Label>
        <Input
          id="lq-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1"
          placeholder="مثلاً: نام برند + نام رقبا"
        />
      </div>

      {/* Keywords */}
      <div>
        <Label htmlFor="lq-keywords" className="text-xs text-ink-tertiary">
          کلمات کلیدی (با کاما جدا کنید)
        </Label>
        <Textarea
          id="lq-keywords"
          value={keywordsText}
          onChange={(e) => setKeywordsText(e.target.value)}
          className="mt-1 min-h-20"
          placeholder="نشرینو، نشر، رقیب۱، رقیب۲"
        />
      </div>

      {/* Providers */}
      <div>
        <Label className="text-xs text-ink-tertiary">پلتفرم‌ها</Label>
        <div className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROVIDER_OPTIONS.map((p) => (
            <label
              key={p}
              className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <Checkbox
                checked={providers.includes(p)}
                onCheckedChange={() => toggleProvider(p)}
              />
              <span className="text-sm text-ink-primary">
                {PROVIDER_LABELS[p] ?? p}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <Label className="text-xs text-ink-tertiary">
          زبان‌ها (اختیاری — خالی = همه)
        </Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {LANGUAGE_OPTIONS.map((l) => (
            <label
              key={l}
              className="flex items-center gap-2 rounded-md border border-border p-2 cursor-pointer hover:bg-surface-hover transition-colors"
            >
              <Checkbox
                checked={languages.includes(l)}
                onCheckedChange={() => toggleLanguage(l)}
              />
              <span className="text-sm text-ink-primary">
                {LANGUAGE_LABELS[l] ?? l}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Spike alert config */}
      <div className="rounded-lg border border-border p-3 space-y-3">
        <label className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="size-4 text-warning" />
            <span className="text-sm font-medium text-ink-primary">
              هشدار اسپایک
            </span>
          </div>
          <Switch
            checked={spikeAlertEnabled}
            onCheckedChange={setSpikeAlertEnabled}
            aria-label="فعال‌سازی هشدار اسپایک"
          />
        </label>
        {spikeAlertEnabled && (
          <div>
            <Label htmlFor="lq-threshold" className="text-xs text-ink-tertiary">
              آستانه (انحراف معیار از میانگین)
            </Label>
            <Input
              id="lq-threshold"
              type="number"
              step="0.5"
              min="0.5"
              max="10"
              value={spikeThreshold}
              onChange={(e) => setSpikeThreshold(Number(e.target.value))}
              className="mt-1"
            />
            <p className="text-2xs text-ink-tertiary mt-1 leading-relaxed">
              هر چه آستانه بالاتر، فقط کامنت‌های بسیار پررنگ هشدار داده می‌شوند.
              پیش‌فرض ۳ انحراف معیار.
            </p>
          </div>
        )}
      </div>

      {/* Coverage notes */}
      <div>
        <Label htmlFor="lq-coverage" className="text-xs text-ink-tertiary">
          یادداشت پوشش (چه چیزی قابل دسترسی نیست)
        </Label>
        <Textarea
          id="lq-coverage"
          value={coverageNotes}
          onChange={(e) => setCoverageNotes(e.target.value)}
          className="mt-1 min-h-20"
          placeholder="مثلاً: فقط کامنت‌های اینستاگرام — دایرکت‌ها از طریق API قابل دسترسی نیستند"
        />
        <p className="text-2xs text-ink-tertiary mt-1 leading-relaxed">
          این متن در همه سطح‌ها به مخاطب نمایش داده می‌شود — صادقانه بنویسید.
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <Button
          variant="outline"
          className="n-focus-ring"
          onClick={onCancel}
          disabled={submitting}
        >
          انصراف
        </Button>
        <Button
          className="n-focus-ring"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {mode === 'create' ? (
            <>
              <Plus className="size-4" />
              ایجاد
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              ذخیره
            </>
          )}
        </Button>
      </div>
    </div>
  )
}

// ── Mentions list (inside sheet) ────────────────────────────────────────────

function MentionsList({
  queryId,
  query,
}: {
  queryId: string
  query: ListeningQueryItem
}) {
  const [spikeFilter, setSpikeFilter] = useState(false)
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [languageFilter, setLanguageFilter] = useState<string>('all')

  // Build query string from filters.
  const qs = useMemo(() => {
    const params = new URLSearchParams()
    params.set('limit', '20')
    if (spikeFilter) params.set('spike', 'true')
    if (sentimentFilter !== 'all') params.set('sentiment', sentimentFilter)
    if (languageFilter !== 'all') params.set('language', languageFilter)
    return params.toString()
  }, [spikeFilter, sentimentFilter, languageFilter])

  const { data, isLoading, isError, refetch } = useQuery<MentionListResult>({
    queryKey: ['listening-mentions', queryId, qs],
    queryFn: () =>
      api.get<MentionListResult>(`/api/listening/${queryId}/mentions?${qs}`),
  })

  // Accumulated mentions across the first page + any "load more" pages.
  const [extraMentions, setExtraMentions] = useState<ListeningMentionItem[]>([])
  const [extraCursor, setExtraCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset accumulated extras whenever filters change (new first-page query).
  useEffect(() => {
    setExtraMentions([])
    setExtraCursor(null)
  }, [qs])

  const firstPage = data?.data ?? []
  const allMentions = [...firstPage, ...extraMentions]
  // nextCursor: prefer the extraCursor (most recently loaded), fall back to
  // the first-page cursor if no extras have been loaded yet.
  const nextCursor =
    extraMentions.length > 0 ? extraCursor : (data?.nextCursor ?? null)

  const loadMore = async () => {
    const cursor = nextCursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const more = await api.get<MentionListResult>(
        `/api/listening/${queryId}/mentions?${qs}&cursor=${cursor}`
      )
      setExtraMentions((prev) => [...prev, ...more.data])
      setExtraCursor(more.nextCursor)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'بارگذاری بیشتر ناموفق بود.')
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Coverage disclosure (per-query) */}
      <div className="rounded-lg border border-info/30 bg-info-soft/30 p-3 flex items-start gap-2">
        <Info className="size-4 shrink-0 text-info mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="text-2xs font-bold text-info">پوشش داده‌ها</p>
          <p className="text-2xs text-ink-secondary mt-1 leading-relaxed">
            {query.coverageNotes?.trim()
              ? query.coverageNotes
              : DEFAULT_COVERAGE_BANNER}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-ink-tertiary" />
        <Button
          size="sm"
          variant={spikeFilter ? 'default' : 'outline'}
          className={cn(
            'n-focus-ring',
            spikeFilter
              ? 'bg-danger text-white hover:bg-danger/90'
              : 'text-danger hover:bg-danger-soft hover:text-danger'
          )}
          onClick={() => setSpikeFilter((v) => !v)}
        >
          <AlertTriangle className="size-3.5" />
          فقط اسپایک
        </Button>
        <Select value={sentimentFilter} onValueChange={setSentimentFilter}>
          <SelectTrigger className="h-8 w-32 text-2xs">
            <SelectValue placeholder="احساس" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه احساس‌ها</SelectItem>
            <SelectItem value="positive">مثبت</SelectItem>
            <SelectItem value="neutral">خنثی</SelectItem>
            <SelectItem value="negative">منفی</SelectItem>
          </SelectContent>
        </Select>
        <Select value={languageFilter} onValueChange={setLanguageFilter}>
          <SelectTrigger className="h-8 w-28 text-2xs">
            <SelectValue placeholder="زبان" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">همه زبان‌ها</SelectItem>
            <SelectItem value="fa">فارسی</SelectItem>
            <SelectItem value="en">انگلیسی</SelectItem>
            <SelectItem value="ar">عربی</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Mentions list */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری کامنت‌ها"
        skeleton={
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {allMentions.length === 0 ? (
          <div className="n-card p-8">
            <EmptyState
              icon={MessageCircle}
              title="کامنتی یافت نشد"
              message="هنوز کامنتی برای این جستجو ثبت نشده است. ممکن است پلتفرم‌ها هنوز اسکن نشده باشند یا فیلترها تطابق نداشته باشند."
            />
          </div>
        ) : (
          <div className="space-y-3">
            {allMentions.map((m) => (
              <MentionCard key={m.id} mention={m} />
            ))}
            {nextCursor && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  className="n-focus-ring"
                  onClick={loadMore}
                  disabled={loadingMore}
                >
                  <RefreshCw
                    className={cn('size-3.5', loadingMore && 'animate-spin')}
                  />
                  بارگذاری بیشتر
                </Button>
              </div>
            )}
          </div>
        )}
      </LoadingState>
    </div>
  )
}

// ── Mention card ─────────────────────────────────────────────────────────────
//
// Coverage rules (#251):
//   - autoSentiment is NEVER shown — only verifiedSentiment.
//   - When verifiedSentiment is null, show "احساس بررسی نشده".
//   - coverageSource text always displayed.
//   - isSpike → red badge.

function MentionCard({ mention }: { mention: ListeningMentionItem }) {
  const sentimentBadge = mention.verifiedSentiment ? (
    <StatusBadge
      label={SENTIMENT_LABELS[mention.verifiedSentiment] ?? mention.verifiedSentiment}
      variant={SENTIMENT_VARIANT[mention.verifiedSentiment] ?? 'draft'}
    />
  ) : (
    <span className="inline-flex items-center rounded-md border border-border bg-surface-hover px-2 py-0.5 text-2xs font-medium text-ink-tertiary">
      احساس بررسی نشده
    </span>
  )

  return (
    <div className="n-card p-4 space-y-3">
      {/* Header: author + provider + spike */}
      <div className="flex items-start gap-3">
        {mention.authorAvatar ? (
          <img
            src={mention.authorAvatar}
            alt={mention.authorName}
            className="size-9 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="size-9 shrink-0 rounded-full bg-accent-soft flex items-center justify-center text-sm font-bold text-accent">
            {mention.authorName.charAt(0)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-ink-primary truncate">
              {mention.authorName}
            </p>
            <MiniChip
              icon={Globe}
              label={PROVIDER_LABELS[mention.provider] ?? mention.provider}
            />
            {mention.detectedLanguage && (
              <span className="inline-flex items-center rounded-md bg-surface-hover px-1.5 py-0.5 text-2xs font-mono text-ink-tertiary">
                {mention.detectedLanguage}
              </span>
            )}
            {mention.isSpike && (
              <span className="inline-flex items-center gap-1 rounded-md bg-danger-soft px-2 py-0.5 text-2xs font-bold text-danger">
                <Sparkles className="size-3" />
                اسپایک
                {mention.spikeScore !== null && (
                  <span className="num-tabular">
                    {toPersianDigits(mention.spikeScore.toFixed(1))}σ
                  </span>
                )}
              </span>
            )}
          </div>
          <p className="text-2xs text-ink-tertiary mt-0.5">
            {formatJalali(new Date(mention.mentionedAt), true)}
          </p>
        </div>
      </div>

      {/* Content */}
      <p className="text-sm text-ink-primary leading-relaxed whitespace-pre-wrap break-words">
        {mention.content}
      </p>

      {/* Engagement + sentiment */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <span className="inline-flex items-center gap-1 text-2xs text-ink-secondary num-tabular">
          <Heart className="size-3.5" />
          {toPersianDigits(mention.likes)}
        </span>
        <span className="inline-flex items-center gap-1 text-2xs text-ink-secondary num-tabular">
          <MessageCircle className="size-3.5" />
          {toPersianDigits(mention.comments)}
        </span>
        <span className="inline-flex items-center gap-1 text-2xs text-ink-secondary num-tabular">
          <Repeat2 className="size-3.5" />
          {toPersianDigits(mention.shares)}
        </span>
        <div className="ms-auto">{sentimentBadge}</div>
      </div>

      {/* Coverage source (#251 — always shown) */}
      {mention.coverageSource && (
        <div className="flex items-center gap-1.5 pt-1 border-t border-border/40">
          <Info className="size-3 text-ink-tertiary" />
          <span className="text-2xs text-ink-tertiary">
            منبع: {mention.coverageSource}
          </span>
        </div>
      )}

      {/* Source URL */}
      {mention.sourceUrl && (
        <a
          href={mention.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-2xs text-accent hover:underline"
        >
          <Eye className="size-3" />
          مشاهده در پلتفرم
        </a>
      )}
    </div>
  )
}
