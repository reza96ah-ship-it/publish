'use client'

/**
 * Issue #249: Versioned workflow builder — admin view (`/automations`).
 *
 * A client component following the campaigns-view + smart-pages-view pattern:
 *  - useQuery(['automations']) lists automations via api.getPaginated
 *  - useMutation for create / update / delete / toggle / killSwitch with
 *    optimistic updates + rollback
 *  - LoadingState + EmptyState + SkeletonCard for loading / empty / error
 *  - Edit <Sheet> for building an automation: name, description, trigger /
 *    condition / action editors, dry-run toggle, approval toggle, max-runs/hr
 *  - Run history <Sheet> with step-level detail (trigger, conditions, actions,
 *    status, error, timestamps)
 *  - Workspace-wide kill switch with AlertDialog confirmation
 *  - pageTransition + pageTransitionProps for view enter animation
 *  - toast + announce() for accessibility
 *  - toPersianDigits + formatJalali for locale-aware display
 */

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Workflow,
  Plus,
  Power,
  History,
  Pencil,
  Trash2,
  Play,
  Pause,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Clock,
  Filter,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react'

import { api } from '@/lib/api'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type {
  AutomationItem,
  AutomationRunItem,
  Trigger,
  Condition,
  Action,
  TriggerType,
  ConditionType,
  ActionType,
  AutomationDefinition,
} from '@/modules/automations'

// ── Type metadata ────────────────────────────────────────────────────────────
//
// Drives the type <Select> dropdowns + per-row icon in the editor.

const TRIGGER_TYPES: { type: TriggerType; label: string }[] = [
  { type: 'schedule', label: 'زمان‌بندی' },
  { type: 'keyword', label: 'کلمه کلیدی' },
  { type: 'status_change', label: 'تغییر وضعیت' },
  { type: 'provider_event', label: 'رویداد پلتفرم' },
  { type: 'date_holiday', label: 'تاریخ / تعطیلی' },
]

const CONDITION_TYPES: { type: ConditionType; label: string }[] = [
  { type: 'channel', label: 'کانال' },
  { type: 'tag', label: 'برچسب' },
  { type: 'campaign', label: 'کمپین' },
  { type: 'time_window', label: 'بازه زمانی' },
  { type: 'approval_state', label: 'وضعیت تأیید' },
]

const ACTION_TYPES: { type: ActionType; label: string }[] = [
  { type: 'create_draft', label: 'ساخت پیش‌نویس' },
  { type: 'add_to_queue', label: 'افزودن به صف' },
  { type: 'send_notification', label: 'ارسال اعلان' },
  { type: 'assign_inbox', label: 'ارجاع به صندوق ورودی' },
  { type: 'add_reply', label: 'افزودن پاسخ' },
  { type: 'add_tag', label: 'افزودن برچسب' },
  { type: 'call_webhook', label: 'فراخوانی وب‌هوک' },
]

const RUN_STATUS_LABEL: Record<string, string> = {
  pending: 'در انتظار',
  running: 'در حال اجرا',
  completed: 'تکمیل‌شده',
  failed: 'ناموفق',
  cancelled: 'لغوشده',
  approval_required: 'نیازمند تأیید',
}

const RUN_STATUS_VARIANT: Record<string, string> = {
  pending: 'pending',
  running: 'pending',
  completed: 'published',
  failed: 'high',
  cancelled: 'draft',
  approval_required: 'review',
}

function emptyTrigger(type: TriggerType): Trigger {
  return { type, config: {} }
}

function emptyCondition(type: ConditionType): Condition {
  return { type, config: {} }
}

function emptyAction(type: ActionType): Action {
  return { type, config: {} }
}

function emptyDefinition(): AutomationDefinition {
  return {
    triggers: [emptyTrigger('schedule')],
    conditions: [],
    actions: [emptyAction('send_notification')],
  }
}

// ── View ─────────────────────────────────────────────────────────────────────

export function AutomationsView() {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [showKillDialog, setShowKillDialog] = useState(false)
  const queryClient = useQueryClient()

  const { data: automations, isLoading, isError, refetch } = useQuery<AutomationItem[]>({
    queryKey: ['automations'],
    queryFn: () => api.getPaginated<AutomationItem>('/api/automations'),
  })

  const editing = automations?.find((a) => a.id === editingId) ?? null

  const stats = useMemo(() => {
    const total = automations?.length ?? 0
    const active = automations?.filter((a) => a.isActive && !a.isPaused).length ?? 0
    const paused = automations?.filter((a) => a.isPaused).length ?? 0
    const killSwitchOn = automations?.some((a) => a.killSwitch) ?? false
    return { total, active, paused, killSwitchOn }
  }, [automations])

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation<AutomationItem, Error, Partial<AutomationItem>>({
    mutationFn: (input) =>
      api.post<AutomationItem>('/api/automations', {
        name: input.name ?? 'اتوماسیون جدید',
        ...(input.description ? { description: input.description } : {}),
        definition: input.definition ?? emptyDefinition(),
        dryRunMode: input.dryRunMode ?? false,
        requireApproval: input.requireApproval ?? false,
        maxRunsPerHour: input.maxRunsPerHour ?? 10,
      }),
    onSuccess: () => {
      toast.success('اتوماسیون جدید ایجاد شد.')
      announce('اتوماسیون جدید ایجاد شد')
    },
    onError: (err) => {
      toast.error(err.message || 'ایجاد اتوماسیون ناموفق بود.')
      announce('خطا در ایجاد اتوماسیون', 'assertive')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const updateMutation = useMutation<
    AutomationItem,
    Error,
    { id: string; patch: Partial<AutomationItem> }
  >({
    mutationFn: ({ id, patch }) => api.patch<AutomationItem>(`/api/automations/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ['automations'] })
      const previous = queryClient.getQueryData<AutomationItem[]>(['automations'])
      queryClient.setQueryData<AutomationItem[]>(['automations'], (old) =>
        (old ?? []).map((a) => (a.id === id ? ({ ...a, ...patch } as AutomationItem) : a))
      )
      return { previous }
    },
    onError: (err, _vars, context: unknown) => {
      const ctx = context as { previous?: AutomationItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['automations'], ctx.previous)
      toast.error(err.message || 'ذخیره تغییرات ناموفق بود.')
      announce('خطا در ذخیره اتوماسیون', 'assertive')
    },
    onSuccess: () => {
      toast.success('تغییرات ذخیره شد.')
      announce('تغییرات اتوماسیون ذخیره شد')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const toggleMutation = useMutation<
    AutomationItem,
    Error,
    { id: string; field: 'isActive' | 'isPaused' | 'dryRunMode'; value: boolean }
  >({
    mutationFn: ({ id, field, value }) =>
      api.post<AutomationItem>(`/api/automations/${id}/toggle`, { [field]: value }),
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['automations'] })
      const previous = queryClient.getQueryData<AutomationItem[]>(['automations'])
      queryClient.setQueryData<AutomationItem[]>(['automations'], (old) =>
        (old ?? []).map((a) =>
          a.id === id ? ({ ...a, [field]: value } as AutomationItem) : a
        )
      )
      return { previous }
    },
    onError: (err, _vars, context: unknown) => {
      const ctx = context as { previous?: AutomationItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['automations'], ctx.previous)
      toast.error(err.message || 'تغییر وضعیت ناموفق بود.')
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const deleteMutation = useMutation<void, Error, AutomationItem>({
    mutationFn: (item) => api.delete<void>(`/api/automations/${item.id}`),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['automations'] })
      const previous = queryClient.getQueryData<AutomationItem[]>(['automations'])
      queryClient.setQueryData<AutomationItem[]>(['automations'], (old) =>
        (old ?? []).filter((a) => a.id !== item.id)
      )
      return { previous }
    },
    onError: (err, _item, context: unknown) => {
      const ctx = context as { previous?: AutomationItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['automations'], ctx.previous)
      toast.error(err.message || 'حذف اتوماسیون ناموفق بود.')
      announce('خطا در حذف اتوماسیون', 'assertive')
    },
    onSuccess: () => {
      toast.success('اتوماسیون حذف شد.')
      setEditingId(null)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const killSwitchMutation = useMutation<{ count: number }, Error, boolean>({
    mutationFn: (activate) =>
      api.post<{ count: number }>('/api/automations/kill-switch', { activate }),
    onMutate: async (activate) => {
      await queryClient.cancelQueries({ queryKey: ['automations'] })
      const previous = queryClient.getQueryData<AutomationItem[]>(['automations'])
      queryClient.setQueryData<AutomationItem[]>(['automations'], (old) =>
        (old ?? []).map((a) => ({ ...a, killSwitch: activate }))
      )
      return { previous }
    },
    onError: (err, _activate, context: unknown) => {
      const ctx = context as { previous?: AutomationItem[] } | undefined
      if (ctx?.previous) queryClient.setQueryData(['automations'], ctx.previous)
      toast.error(err.message || 'تغییر وضعیت کلید توقف ناموفق بود.')
      announce('خطا در کلید توقف', 'assertive')
    },
    onSuccess: (data, activate) => {
      toast.success(
        activate
          ? `کلید توقف فعال شد — ${toPersianDigits(data.count)} اتوماسیون متوقف شد.`
          : 'کلید توقف غیرفعال شد.'
      )
      announce(
        activate ? 'کلید توقف کلی فعال شد' : 'کلید توقف کلی غیرفعال شد',
        'assertive'
      )
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }),
  })

  const handleCreate = () => {
    createMutation.mutate({})
  }

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle
        icon={Workflow}
        badge={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className={cn(
                'n-focus-ring',
                stats.killSwitchOn
                  ? 'border-danger/40 text-danger hover:bg-danger-soft'
                  : 'text-danger hover:bg-danger-soft hover:text-danger'
              )}
              onClick={() => setShowKillDialog(true)}
              disabled={killSwitchMutation.isPending}
            >
              <Power className="size-4" />
              {stats.killSwitchOn ? 'کلید توقف فعال' : 'کلید توقف'}
            </Button>
            <Button
              size="sm"
              className="n-focus-ring"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              <Plus className="size-4" />
              ساخت اتوماسیون
            </Button>
          </div>
        }
      >
        اتوماسیون‌ها
      </SectionTitle>

      {/* Kill-switch banner */}
      {stats.killSwitchOn && (
        <div className="n-card flex items-start gap-3 border-danger/30 bg-danger-soft/40 p-4">
          <ShieldAlert className="size-5 shrink-0 text-danger" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-danger">کلید توقف فعال است</p>
            <p className="text-2xs text-ink-secondary mt-1 leading-relaxed">
              تمام اجراهای اتوماسیون در این فضای کاری متوقف شده‌اند. برای ازسرگیری، کلید توقف
              را غیرفعال کنید.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="n-focus-ring border-success/40 text-success hover:bg-success-soft"
            onClick={() => killSwitchMutation.mutate(false)}
            disabled={killSwitchMutation.isPending}
          >
            <ShieldCheck className="size-4" />
            غیرفعال‌سازی
          </Button>
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="کل اتوماسیون‌ها" value={stats.total} icon={Workflow} color="text-accent" />
        <StatCard label="فعال" value={stats.active} icon={Zap} color="text-success" />
        <StatCard label="متوقف" value={stats.paused} icon={Pause} color="text-warning" />
        <StatCard
          label="کلید توقف"
          value={stats.killSwitchOn ? 'روشن' : 'خاموش'}
          icon={stats.killSwitchOn ? ShieldAlert : ShieldCheck}
          color={stats.killSwitchOn ? 'text-danger' : 'text-ink-tertiary'}
          isText
        />
      </div>

      {/* Automations grid */}
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری اتوماسیون‌ها"
        skeleton={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        }
      >
        {!automations || automations.length === 0 ? (
          <div className="n-card p-10">
            <EmptyState
              icon={Workflow}
              title="هنوز اتوماسیونی نساخته‌اید"
              message="با ساخت اتوماسیون می‌توانید فرآیندهای تکراری را خودکار کنید — راه‌انداز، شرط و اقدام را تعریف کنید."
              action={
                <Button
                  size="sm"
                  className="n-focus-ring"
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                >
                  <Plus className="size-4" />
                  ساخت اتوماسیون
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {automations.map((a) => (
              <AutomationCard
                key={a.id}
                automation={a}
                onEdit={() => setEditingId(a.id)}
                onHistory={() => setHistoryId(a.id)}
                onToggleActive={(v) =>
                  toggleMutation.mutate({ id: a.id, field: 'isActive', value: v })
                }
                onTogglePaused={(v) =>
                  toggleMutation.mutate({ id: a.id, field: 'isPaused', value: v })
                }
                onToggleDryRun={(v) =>
                  toggleMutation.mutate({ id: a.id, field: 'dryRunMode', value: v })
                }
                onDelete={() => deleteMutation.mutate(a)}
                toggling={
                  toggleMutation.isPending &&
                  toggleMutation.variables?.id === a.id
                }
                deleting={
                  deleteMutation.isPending && deleteMutation.variables?.id === a.id
                }
              />
            ))}
          </div>
        )}
      </LoadingState>

      {/* Edit sheet */}
      <Sheet open={!!editingId} onOpenChange={(o) => !o && setEditingId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          {editing && (
            <>
              <SheetHeader>
                <SheetTitle className="text-start">{editing.name}</SheetTitle>
                <SheetDescription className="text-start">
                  نسخه {toPersianDigits(editing.version)} ·{' '}
                  {editing.previousDefinition
                    ? 'نسخه قبلی قابل بازگشت است'
                    : 'بدون نسخه قبلی'}
                </SheetDescription>
              </SheetHeader>
              <div className="px-4 pb-6 mt-4">
                <AutomationEditor
                  key={editing.id}
                  automation={editing}
                  onSave={(patch) =>
                    updateMutation.mutate({ id: editing.id, patch })
                  }
                  onDelete={() => deleteMutation.mutate(editing)}
                  saving={updateMutation.isPending}
                  deleting={deleteMutation.isPending}
                />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Run history sheet */}
      <Sheet open={!!historyId} onOpenChange={(o) => !o && setHistoryId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-start">تاریخچه اجراها</SheetTitle>
            <SheetDescription className="text-start">
              جزئیات مرحله‌به‌مرحله هر اجرا (راه‌انداز، شرط‌ها، اقدام‌ها، وضعیت)
            </SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6 mt-4">
            {historyId && <RunHistoryList automationId={historyId} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Kill switch confirmation */}
      <AlertDialog open={showKillDialog} onOpenChange={setShowKillDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>فعال‌سازی کلید توقف کلی</AlertDialogTitle>
            <AlertDialogDescription>
              این عملیات تمام اتوماسیون‌های این فضای کاری را فوراً متوقف می‌کند و همه اجراهای
              در حال انجام لغو خواهند شد. آیا ادامه می‌دهید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="n-focus-ring">انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="n-focus-ring bg-danger text-white hover:bg-danger/90"
              onClick={() => {
                killSwitchMutation.mutate(true)
                setShowKillDialog(false)
              }}
            >
              <Power className="size-4" />
              فعال‌سازی
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  )
}

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isText = false,
}: {
  label: string
  value: number | string
  icon: typeof Workflow
  color: string
  isText?: boolean
}) {
  return (
    <div className="n-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-tertiary">{label}</span>
        <Icon className={cn('size-4', color)} />
      </div>
      <p className="text-xl font-bold text-ink-primary num-tabular">
        {isText ? value : toPersianDigits(value as number)}
      </p>
    </div>
  )
}

// ── Automation card ──────────────────────────────────────────────────────────

function AutomationCard({
  automation,
  onEdit,
  onHistory,
  onToggleActive,
  onTogglePaused: _onTogglePaused,
  onToggleDryRun: _onToggleDryRun,
  onDelete,
  toggling,
  deleting,
}: {
  automation: AutomationItem
  onEdit: () => void
  onHistory: () => void
  onToggleActive: (v: boolean) => void
  onTogglePaused: (v: boolean) => void
  onToggleDryRun: (v: boolean) => void
  onDelete: () => void
  toggling: boolean
  deleting: boolean
}) {
  const a = automation
  const statusBadge = a.killSwitch ? (
    <StatusBadge label="کلید توقف" variant="high" />
  ) : a.isPaused ? (
    <StatusBadge label="متوقف" variant="pending" />
  ) : a.isActive ? (
    <StatusBadge label="فعال" variant="published" />
  ) : (
    <StatusBadge label="پیش‌نویس" variant="draft" />
  )

  return (
    <div className="n-card-interactive n-focus-ring p-5 text-start">
      <button onClick={onEdit} className="flex w-full flex-col text-start">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-ink-primary truncate">{a.name}</p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              نسخه {toPersianDigits(a.version)} · حداکثر{' '}
              {toPersianDigits(a.maxRunsPerHour)} اجرا در ساعت
            </p>
          </div>
          {statusBadge}
        </div>

        <p className="text-xs text-ink-secondary line-clamp-2 mb-3 min-h-8">
          {a.description ?? 'بدون توضیحات'}
        </p>

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <MiniChip
            icon={Zap}
            label={`${toPersianDigits(a.definition.triggers.length)} راه‌انداز`}
          />
          <MiniChip
            icon={Filter}
            label={`${toPersianDigits(a.definition.conditions.length)} شرط`}
          />
          <MiniChip
            icon={ArrowLeft}
            label={`${toPersianDigits(a.definition.actions.length)} اقدام`}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 text-2xs text-ink-tertiary">
          {a.dryRunMode && (
            <span className="inline-flex items-center gap-1 rounded-md bg-warning-soft px-2 py-0.5 font-medium text-warning">
              <AlertTriangle className="size-3" />
              حالت آزمایشی
            </span>
          )}
          {a.requireApproval && (
            <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-2 py-0.5 font-medium text-info">
              <ShieldCheck className="size-3" />
              نیازمند تأیید
            </span>
          )}
          <span className="ms-auto">
            {formatJalali(new Date(a.updatedAt), true)}
          </span>
        </div>
      </button>

      <Separator className="my-3" />

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={() => onToggleActive(!a.isActive)}
          disabled={toggling || a.killSwitch}
        >
          {a.isActive ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
          {a.isActive ? 'توقف' : 'فعال‌سازی'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={onHistory}
        >
          <History className="size-3.5" />
          اجراها
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="n-focus-ring"
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
          ویرایش
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="n-focus-ring ms-auto text-danger hover:bg-danger-soft hover:text-danger"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

function MiniChip({ icon: Icon, label }: { icon: typeof Zap; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-hover px-2 py-0.5 text-2xs font-medium text-ink-secondary">
      <Icon className="size-3" />
      {label}
    </span>
  )
}

// ── Automation editor ────────────────────────────────────────────────────────

function AutomationEditor({
  automation,
  onSave,
  onDelete,
  saving,
  deleting,
}: {
  automation: AutomationItem
  onSave: (patch: Partial<AutomationItem>) => void
  onDelete: () => void
  saving: boolean
  deleting: boolean
}) {
  const [name, setName] = useState(automation.name)
  const [description, setDescription] = useState(automation.description ?? '')
  const [triggers, setTriggers] = useState<Trigger[]>(automation.definition.triggers)
  const [conditions, setConditions] = useState<Condition[]>(automation.definition.conditions)
  const [actions, setActions] = useState<Action[]>(automation.definition.actions)
  const [dryRunMode, setDryRunMode] = useState(automation.dryRunMode)
  const [requireApproval, setRequireApproval] = useState(automation.requireApproval)
  const [maxRunsPerHour, setMaxRunsPerHour] = useState(automation.maxRunsPerHour)

  const handleSave = () => {
    onSave({
      name,
      ...(description ? { description } : {}),
      definition: { triggers, conditions, actions },
      dryRunMode,
      requireApproval,
      maxRunsPerHour,
    })
  }

  return (
    <div className="space-y-4">
      {/* Basic info */}
      <div className="space-y-3">
        <div>
          <Label htmlFor="auto-name" className="text-xs text-ink-tertiary">
            نام اتوماسیون
          </Label>
          <Input
            id="auto-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            placeholder="مثلاً: پاسخ خودکار به کامنت‌ها"
          />
        </div>
        <div>
          <Label htmlFor="auto-desc" className="text-xs text-ink-tertiary">
            توضیحات
          </Label>
          <Textarea
            id="auto-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 min-h-20"
            placeholder="این اتوماسیون چه کاری انجام می‌دهد؟"
          />
        </div>
      </div>

      <Separator />

      {/* Triggers */}
      <DefinitionSection
        title="راه‌اندازها"
        subtitle="چه چیزی این اتوماسیون را اجرا می‌کند؟"
        icon={Zap}
        items={triggers}
        types={TRIGGER_TYPES}
        onChange={setTriggers}
        makeEmpty={emptyTrigger}
        accent="text-accent"
      />

      {/* Conditions */}
      <DefinitionSection
        title="شرط‌ها"
        subtitle="چه زمانی اتوماسیون اجرا شود؟ (همه شرط‌ها باید برقرار باشند)"
        icon={Filter}
        items={conditions}
        types={CONDITION_TYPES}
        onChange={setConditions}
        makeEmpty={emptyCondition}
        accent="text-info"
      />

      {/* Actions */}
      <DefinitionSection
        title="اقدام‌ها"
        subtitle="چه کاری انجام شود؟"
        icon={ArrowLeft}
        items={actions}
        types={ACTION_TYPES}
        onChange={setActions}
        makeEmpty={emptyAction}
        accent="text-success"
      />

      <Separator />

      {/* Operational toggles */}
      <div className="space-y-3">
        <ToggleRow
          label="حالت آزمایشی (Dry Run)"
          description="اقدامات اجرا نمی‌شوند — فقط در تاریخچه ثبت می‌شوند."
          checked={dryRunMode}
          onChange={setDryRunMode}
        />
        <ToggleRow
          label="نیازمند تأیید انسانی"
          description="قبل از اجرای اقدامات، تأیید یک مدیر لازم است."
          checked={requireApproval}
          onChange={setRequireApproval}
        />
        <div>
          <Label htmlFor="max-runs" className="text-xs text-ink-tertiary">
            حداکثر اجرا در ساعت
          </Label>
          <Input
            id="max-runs"
            type="number"
            min={1}
            max={1000}
            value={maxRunsPerHour}
            onChange={(e) => setMaxRunsPerHour(Number(e.target.value) || 1)}
            className="mt-1 max-w-32"
          />
        </div>
      </div>

      <Separator />

      {/* Save bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-2 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <Button
          variant="ghost"
          className="n-focus-ring text-danger hover:bg-danger-soft hover:text-danger"
          onClick={onDelete}
          disabled={deleting}
        >
          <Trash2 className="size-4" />
          حذف
        </Button>
        <Button onClick={handleSave} disabled={saving} className="n-focus-ring min-w-[140px]">
          {saving ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
        </Button>
      </div>
    </div>
  )
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-ink-primary">{label}</p>
        <p className="text-2xs text-ink-tertiary mt-0.5 leading-relaxed">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </div>
  )
}

// ── Definition section (triggers / conditions / actions) ────────────────────

interface DefinitionSectionProps<T extends { type: string; config: Record<string, unknown> }> {
  title: string
  subtitle: string
  icon: typeof Zap
  items: T[]
  types: { type: string; label: string }[]
  onChange: (next: T[]) => void
  makeEmpty: (type: T['type']) => T
  accent: string
}

function DefinitionSection<T extends { type: string; config: Record<string, unknown> }>({
  title,
  subtitle,
  icon: Icon,
  items,
  types,
  onChange,
  makeEmpty,
  accent,
}: DefinitionSectionProps<T>) {
  const update = (index: number, patch: Partial<T>) => {
    onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }
  const remove = (index: number) => onChange(items.filter((_, i) => i !== index))
  const add = (type: T['type']) => onChange([...items, makeEmpty(type)])

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('size-4', accent)} />
        <p className="text-sm font-bold text-ink-primary">{title}</p>
      </div>
      <p className="text-2xs text-ink-tertiary mb-3 leading-relaxed">{subtitle}</p>

      <div className="space-y-2 mb-3">
        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-5 text-center text-2xs text-ink-tertiary">
            موردی اضافه نشده است.
          </p>
        ) : (
          items.map((item, index) => (
            <DefinitionRow
              key={index}
              item={item}
              types={types}
              onChange={(patch) => update(index, patch)}
              onRemove={() => remove(index)}
            />
          ))
        )}
      </div>

      <Select
        value=""
        onValueChange={(v) => {
          if (v) add(v as T['type'])
        }}
      >
        <SelectTrigger className="n-focus-ring h-8 w-full max-w-64 text-xs">
          <Plus className="size-3" />
          <SelectValue placeholder="افزودن…" />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.type} value={t.type}>
              {t.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function DefinitionRow<T extends { type: string; config: Record<string, unknown> }>({
  item,
  types,
  onChange,
  onRemove,
}: {
  item: T
  types: { type: string; label: string }[]
  onChange: (patch: Partial<T>) => void
  onRemove: () => void
}) {
  const label = types.find((t) => t.type === item.type)?.label ?? item.type
  return (
    <div className="rounded-lg border border-border bg-surface-subtle px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <Select
          value={item.type}
          onValueChange={(v) => onChange({ type: v } as Partial<T>)}
        >
          <SelectTrigger className="n-focus-ring h-7 max-w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.type} value={t.type}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="ghost"
          className="n-focus-ring size-7 p-0 text-danger hover:bg-danger-soft hover:text-danger"
          onClick={onRemove}
          aria-label={`حذف ${label}`}
        >
          <XCircle className="size-3.5" />
        </Button>
      </div>
      <ConfigEditor
        type={item.type}
        config={item.config}
        onChange={(config) => onChange({ config } as Partial<T>)}
      />
    </div>
  )
}

/**
 * Per-type config editor. Each type exposes a small set of fields. We render a
 * dynamic set of <Input> rows driven by a per-type field-spec so adding a new
 * type is a one-line change.
 */
const CONFIG_FIELDS: Record<string, { key: string; label: string; placeholder?: string }[]> = {
  schedule: [{ key: 'cron', label: 'عبارت Cron', placeholder: '0 9 * * *' }],
  keyword: [{ key: 'text', label: 'کلمه کلیدی', placeholder: 'مثلاً: خرید' }],
  status_change: [
    { key: 'from', label: 'از وضعیت' },
    { key: 'to', label: 'به وضعیت' },
  ],
  provider_event: [{ key: 'event', label: 'نام رویداد', placeholder: 'publish.success' }],
  date_holiday: [{ key: 'calendar', label: 'تقویم', placeholder: 'jalali' }],
  channel: [{ key: 'channelId', label: 'شناسه کانال' }],
  tag: [{ key: 'tag', label: 'برچسب' }],
  campaign: [{ key: 'campaignId', label: 'شناسه کمپین' }],
  time_window: [
    { key: 'start', label: 'از ساعت', placeholder: '09:00' },
    { key: 'end', label: 'تا ساعت', placeholder: '18:00' },
  ],
  approval_state: [{ key: 'state', label: 'وضعیت', placeholder: 'pending' }],
  create_draft: [{ key: 'template', label: 'قالب' }],
  add_to_queue: [{ key: 'queueId', label: 'شناسه صف' }],
  send_notification: [{ key: 'message', label: 'پیام اعلان' }],
  assign_inbox: [{ key: 'assigneeId', label: 'شناسه کاربر' }],
  add_reply: [{ key: 'reply', label: 'متن پاسخ' }],
  add_tag: [{ key: 'tag', label: 'برچسب' }],
  call_webhook: [{ key: 'url', label: 'آدرس وب‌هوک', placeholder: 'https://' }],
}

function ConfigEditor({
  type,
  config,
  onChange,
}: {
  type: string
  config: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  const fields = CONFIG_FIELDS[type] ?? []
  return (
    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {fields.length === 0 ? (
        <p className="text-2xs text-ink-tertiary">
          این نوع نیازی به پیکربندی اضافی ندارد.
        </p>
      ) : (
        fields.map((f) => (
          <div key={f.key}>
            <Label className="text-2xs text-ink-tertiary">{f.label}</Label>
            <Input
              value={typeof config[f.key] === 'string' ? (config[f.key] as string) : ''}
              placeholder={f.placeholder}
              onChange={(e) => onChange({ ...config, [f.key]: e.target.value })}
              className="h-7 text-xs"
            />
          </div>
        ))
      )}
    </div>
  )
}

// ── Run history ──────────────────────────────────────────────────────────────

function RunHistoryList({ automationId }: { automationId: string }) {
  const { data, isLoading, isError, refetch } = useQuery<AutomationRunItem[]>({
    queryKey: ['automation-runs', automationId],
    queryFn: () => api.getPaginated<AutomationRunItem>(`/api/automations/${automationId}/runs`),
  })

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="n-card p-4">
            <div className="h-3 w-32 rounded bg-surface-hover" />
            <div className="mt-2 h-2 w-48 rounded bg-surface-hover" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div className="n-card p-6 text-center">
        <p className="text-sm text-ink-secondary">خطا در بارگذاری تاریخچه اجراها.</p>
        <Button size="sm" variant="outline" className="n-focus-ring mt-3" onClick={() => refetch()}>
          تلاش مجدد
        </Button>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div className="n-card p-8">
        <EmptyState
          icon={History}
          title="هنوز اجرایی ثبت نشده است"
          message="با فعال شدن اتوماسیون، اجراهای آن در این بخش نمایش داده می‌شوند."
          size="compact"
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {data.map((run) => (
        <RunHistoryCard key={run.id} run={run} />
      ))}
    </div>
  )
}

function RunHistoryCard({ run }: { run: AutomationRunItem }) {
  const [expanded, setExpanded] = useState(false)
  const variant = RUN_STATUS_VARIANT[run.status] ?? 'draft'
  const label = RUN_STATUS_LABEL[run.status] ?? run.status

  return (
    <div className="n-card p-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-start"
      >
        <div className="flex items-center gap-2 min-w-0">
          {run.status === 'completed' ? (
            <CheckCircle2 className="size-4 shrink-0 text-success" />
          ) : run.status === 'failed' ? (
            <XCircle className="size-4 shrink-0 text-danger" />
          ) : run.status === 'cancelled' ? (
            <XCircle className="size-4 shrink-0 text-ink-tertiary" />
          ) : (
            <Clock className="size-4 shrink-0 text-warning" />
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-primary truncate">
              نسخه {toPersianDigits(run.version)}
            </p>
            <p className="text-2xs text-ink-tertiary">
              {relativeTime(new Date(run.createdAt))} ·{' '}
              {formatJalali(new Date(run.createdAt), true)}
            </p>
          </div>
        </div>
        <StatusBadge label={label} variant={variant} />
      </button>

      {expanded && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          {run.error && (
            <div className="rounded-md bg-danger-soft/50 border border-danger/20 px-3 py-2">
              <p className="text-2xs font-bold text-danger">خطا</p>
              <p className="text-xs text-ink-secondary mt-0.5 break-words">{run.error}</p>
            </div>
          )}

          <RunStep
            icon={Zap}
            title="راه‌انداز"
            data={run.trigger}
          />
          <RunStep
            icon={Filter}
            title="شرط‌ها"
            data={run.conditions}
          />
          <RunStep
            icon={ArrowLeft}
            title="اقدام‌ها"
            data={run.actions}
          />
        </div>
      )}
    </div>
  )
}

function RunStep({
  icon: Icon,
  title,
  data,
}: {
  icon: typeof Zap
  title: string
  data: Record<string, unknown>
}) {
  const json = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2)
    } catch {
      return String(data)
    }
  }, [data])

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="size-3.5 text-ink-tertiary" />
        <p className="text-2xs font-bold text-ink-secondary">{title}</p>
      </div>
      <pre
        dir="ltr"
        className="overflow-x-auto rounded-md bg-surface-subtle px-3 py-2 text-2xs leading-relaxed text-ink-secondary num-tabular max-h-48 overflow-y-auto"
      >
        {json}
      </pre>
    </div>
  )
}
