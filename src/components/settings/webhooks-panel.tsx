'use client'

/**
 * Issue #255: Webhooks admin panel (settings → وب‌هوک).
 *
 * Lists all webhooks registered for the workspace, lets the admin add new
 * webhooks (HTTPS URL + selected events), shows the HMAC signing secret ONCE
 * on creation, and supports per-webhook active toggle, test event, delivery
 * history sheet, and delete.
 *
 * The signing secret is shown ONLY in the create response — neither the
 * list nor any subsequent fetch returns it. If the admin loses the secret
 * they must rotate (delete webhook + create new).
 *
 * Backend:
 *   GET    /api/webhooks                       — list (no secrets)
 *   POST   /api/webhooks                       — create, returns { webhook, secret } (201)
 *   PATCH  /api/webhooks/[id]                  — update url/events/isActive
 *   DELETE /api/webhooks/[id]                  — delete (204)
 *   POST   /api/webhooks/[id]/test             — send test event
 *   GET    /api/webhooks/[id]/deliveries       — recent delivery history
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Webhook as WebhookIcon,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  History,
  Send,
} from 'lucide-react'

import { api } from '@/lib/api'
import { announce } from '@/lib/aria-live'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { LoadingState, EmptyState } from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

// ── Types ────────────────────────────────────────────────────────────────────

interface WebhookItem {
  id: string
  url: string
  events: string[]
  isActive: boolean
  lastTriggeredAt: string | null
  lastResponseStatus: number | null
  lastError: string | null
  createdAt: string
}

interface CreateWebhookResult {
  webhook: WebhookItem
  secret: string
}

interface TestResult {
  status: number
  ok: boolean
  error?: string
}

interface WebhookDeliveryItem {
  id: string
  webhookId: string
  eventId: string
  eventType: string
  status: 'pending' | 'claimed' | 'delivered' | 'retry_wait' | 'dead_letter' | 'cancelled'
  attemptCount: number
  deliveredAt: string | null
  responseStatus: number | null
  lastError: string | null
  lastErrorCategory: string | null
  deadLetteredAt: string | null
  createdAt: string
}

const EVENT_TYPES: { value: string; label: string }[] = [
  { value: 'publish.success', label: 'موفقیت انتشار' },
  { value: 'publish.failed', label: 'شکست انتشار' },
  { value: 'inbox.new', label: 'پیام جدید' },
  { value: 'content.created', label: 'ایجاد محتوا' },
  { value: 'content.published', label: 'انتشار محتوا' },
]

// ── Panel ────────────────────────────────────────────────────────────────────

export function WebhooksPanel() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookItem | null>(null)
  const [historyTarget, setHistoryTarget] = useState<WebhookItem | null>(null)

  const { data: webhooks = [], isLoading } = useQuery<WebhookItem[]>({
    queryKey: ['webhooks'],
    queryFn: () => api.get<WebhookItem[]>('/api/webhooks'),
  })

  const createMutation = useMutation({
    mutationFn: (input: { url: string; events: string[] }) =>
      api.post<CreateWebhookResult>('/api/webhooks', input),
    onSuccess: (res) => {
      setNewSecret(res.secret)
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('وب‌هوک افزوده شد')
      announce('وب‌هوک جدید افزوده شد')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در افزودن وب‌هوک')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch<WebhookItem>(`/api/webhooks/${id}`, { isActive }),
    onMutate: async ({ id, isActive }) => {
      await qc.cancelQueries({ queryKey: ['webhooks'] })
      const prev = qc.getQueryData<WebhookItem[]>(['webhooks'])
      qc.setQueryData<WebhookItem[]>(['webhooks'], (old) =>
        old ? old.map((w) => (w.id === id ? { ...w, isActive } : w)) : old
      )
      return { prev }
    },
    onSuccess: (_res, { isActive }) => {
      toast.success(isActive ? 'وب‌هوک فعال شد' : 'وب‌هوک غیرفعال شد')
      announce(isActive ? 'وب‌هوک فعال شد' : 'وب‌هوک غیرفعال شد')
    },
    onError: (err: Error, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(['webhooks'], ctx.prev)
      toast.error(err.message || 'خطا در تغییر وضعیت')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })

  const testMutation = useMutation({
    mutationFn: (id: string) => api.post<TestResult>(`/api/webhooks/${id}/test`),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(`تست موفق بود (HTTP ${toPersianDigits(res.status)})`)
        announce('تست وب‌هوک موفق بود')
      } else {
        toast.error(
          `تست ناموفق بود${res.status ? ` (HTTP ${toPersianDigits(res.status)})` : ''}${
            res.error ? ` — ${res.error}` : ''
          }`
        )
      }
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در تست وب‌هوک')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/webhooks/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['webhooks'] })
      const prev = qc.getQueryData<WebhookItem[]>(['webhooks'])
      qc.setQueryData<WebhookItem[]>(['webhooks'], (old) =>
        old ? old.filter((w) => w.id !== id) : old
      )
      return { prev }
    },
    onSuccess: () => {
      toast.success('وب‌هوک حذف شد')
      announce('وب‌هوک حذف شد')
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['webhooks'], ctx.prev)
      toast.error(err.message || 'خطا در حذف')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="n-card p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <WebhookIcon className="size-4 text-accent" />
            <h2 className="text-lg font-semibold text-ink-primary">وب‌هوک‌ها</h2>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            افزودن وب‌هوک
          </Button>
        </div>
        <p className="text-xs text-ink-tertiary mb-4">
          با وب‌هوک، رویدادهای نسکرینو (موفقیت/شکست انتشار، پیام جدید و …) را به‌صورت POST با امضای
          HMAC-SHA256 به آدرس HTTPS دلخواه خود ارسال می‌کنیم. راز امضایی فقط یک‌بار هنگام ساخت
          نمایش داده می‌شود.
        </p>

        <LoadingState
          isLoading={isLoading}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="n-skeleton h-24 rounded-xl" />
              ))}
            </div>
          }
        >
          {webhooks.length === 0 ? (
            <EmptyState
              icon={WebhookIcon}
              title="هنوز وب‌هوکی ثبت نشده"
              message="برای دریافت رویدادها در سرویس بیرونی، اولین وب‌هوک خود را اضافه کنید."
              size="compact"
            />
          ) : (
            <div className="space-y-2">
              {webhooks.map((w) => (
                <WebhookRow
                  key={w.id}
                  webhook={w}
                  onToggle={(isActive) => toggleMutation.mutate({ id: w.id, isActive })}
                  onTest={() => testMutation.mutate(w.id)}
                  onHistory={() => setHistoryTarget(w)}
                  onDelete={() => setDeleteTarget(w)}
                  testPending={testMutation.isPending && testMutation.variables === w.id}
                  togglePending={
                    toggleMutation.isPending && toggleMutation.variables?.id === w.id
                  }
                />
              ))}
            </div>
          )}
        </LoadingState>
      </div>

      <CreateWebhookDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
        }}
        pending={createMutation.isPending}
        onCreate={(input) => createMutation.mutate(input)}
      />

      {/* Secret reveal — shown once after successful create */}
      <Dialog
        open={!!newSecret}
        onOpenChange={(o) => {
          if (!o) setNewSecret(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              راز امضایی ساخته شد
            </DialogTitle>
            <DialogDescription className="text-start">
              این راز فقط یک‌بار نمایش داده می‌شود. آن را در سرویس گیرنده وب‌هوک پیکربندی کنید تا
              بتواند امضای درخواست‌ها را راستی‌آزمایی کند. در صورت گم شدن، باید وب‌هوک را حذف
              کرده و دوباره بسازید.
            </DialogDescription>
          </DialogHeader>
          <CopyableSecret value={newSecret ?? ''} />
          <DialogFooter>
            <Button onClick={() => setNewSecret(null)}>متوجه شدم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف وب‌هوک؟</AlertDialogTitle>
            <AlertDialogDescription>
              آدرس «{deleteTarget?.url}» حذف می‌شود و دیگر رویدادی به آن ارسال نخواهد شد. تاریخچه
              تحویل‌ها نیز پاک خواهد شد. این عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id)
                setDeleteTarget(null)
              }}
            >
              حذف کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delivery history sheet */}
      <DeliveryHistorySheet
        webhook={historyTarget}
        onOpenChange={(o) => !o && setHistoryTarget(null)}
      />
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WebhookRow({
  webhook,
  onToggle,
  onTest,
  onHistory,
  onDelete,
  testPending,
  togglePending,
}: {
  webhook: WebhookItem
  onToggle: (isActive: boolean) => void
  onTest: () => void
  onHistory: () => void
  onDelete: () => void
  testPending: boolean
  togglePending: boolean
}) {
  return (
    <div className="rounded-xl border border-border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p dir="ltr" className="text-left text-sm font-semibold text-ink-primary truncate font-mono">
              {webhook.url}
            </p>
            {webhook.isActive ? (
              <Badge className="bg-success-soft text-success border-transparent">فعال</Badge>
            ) : (
              <Badge variant="secondary">غیرفعال</Badge>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {webhook.events.map((e) => (
              <Badge key={e} variant="outline" className="text-[10px] font-mono">
                {e}
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-tertiary">
            <span>ساخته‌شده: {toPersianDigits(formatJalali(new Date(webhook.createdAt)))}</span>
            {webhook.lastTriggeredAt && (
              <span>
                آخرین ارسال: {toPersianDigits(formatJalali(new Date(webhook.lastTriggeredAt)))}
              </span>
            )}
            {webhook.lastResponseStatus !== null && (
              <span>
                آخرین پاسخ:{' '}
                <span dir="ltr" className="font-mono">
                  HTTP {toPersianDigits(webhook.lastResponseStatus)}
                </span>
              </span>
            )}
            {webhook.lastError && (
              <span className="text-danger truncate max-w-[280px]" title={webhook.lastError}>
                خطا: {webhook.lastError}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ink-tertiary">فعال</span>
            <Switch
              checked={webhook.isActive}
              disabled={togglePending}
              onCheckedChange={onToggle}
              aria-label="فعال/غیرفعال"
            />
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onTest}
              disabled={testPending}
              aria-label="تست وب‌هوک"
              title="تست"
            >
              <Send className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onHistory}
              aria-label="تاریخچه تحویل"
              title="تاریخچه تحویل"
            >
              <History className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              aria-label="حذف وب‌هوک"
              title="حذف"
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function CreateWebhookDialog({
  open,
  onOpenChange,
  pending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pending: boolean
  onCreate: (input: { url: string; events: string[] }) => void
}) {
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['publish.success'])

  function toggleEvent(e: string) {
    setEvents((prev) => (prev.includes(e) ? prev.filter((x) => x !== e) : [...prev, e]))
  }

  function handleClose(o: boolean) {
    if (!o) {
      setUrl('')
      setEvents(['publish.success'])
    }
    onOpenChange(o)
  }

  function submit() {
    if (!/^https:\/\//i.test(url.trim())) {
      toast.error('آدرس وب‌هوک باید با https:// شروع شود')
      return
    }
    try {
      // Validate URL is well-formed
      void new URL(url.trim())
    } catch {
      toast.error('آدرس وب‌هوک نامعتبر است')
      return
    }
    if (events.length === 0) {
      toast.error('حداقل یک رویداد الزامی است')
      return
    }
    onCreate({ url: url.trim(), events })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">افزودن وب‌هوک جدید</DialogTitle>
          <DialogDescription className="text-start">
            آدرس باید HTTPS باشد. راز امضایی پس از ساخت یک‌بار نمایش داده می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">آدرس (HTTPS)</Label>
            <Input
              dir="ltr"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhooks/nashrino"
              className="text-left"
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">رویدادها</Label>
            <div className="space-y-2">
              {EVENT_TYPES.map((e) => (
                <label
                  key={e.value}
                  className="flex items-start gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <Checkbox
                    checked={events.includes(e.value)}
                    onCheckedChange={() => toggleEvent(e.value)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-ink-primary">{e.label}</p>
                    <p dir="ltr" className="text-left text-[11px] text-ink-tertiary font-mono">
                      {e.value}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'در حال افزودن…' : 'افزودن'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CopyableSecret({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('در کلیپ‌بورد کپی شد')
      announce('راز در کلیپ‌بورد کپی شد')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('کپی ناموفق بود — به‌صورت دستی کپی کنید')
    }
  }

  return (
    <div className="space-y-2">
      <div
        dir="ltr"
        className="text-left text-xs font-mono break-all rounded-lg border border-border bg-surface-hover p-3 max-h-32 overflow-y-auto thin-scrollbar"
      >
        {value}
      </div>
      <Button onClick={copy} variant="outline" className="w-full">
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? 'کپی شد' : 'کپی راز امضایی'}
      </Button>
    </div>
  )
}

function DeliveryHistorySheet({
  webhook,
  onOpenChange,
}: {
  webhook: WebhookItem | null
  onOpenChange: (o: boolean) => void
}) {
  const open = !!webhook
  const { data: deliveries = [], isLoading } = useQuery<WebhookDeliveryItem[]>({
    queryKey: ['webhook-deliveries', webhook?.id],
    queryFn: () => api.get<WebhookDeliveryItem[]>(`/api/webhooks/${webhook?.id}/deliveries`),
    enabled: open,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto thin-scrollbar">
        <SheetHeader>
          <SheetTitle className="text-start">تاریخچه تحویل</SheetTitle>
          <SheetDescription className="text-start">
            ۵۰ تحویل اخیر این وب‌هوک — شامل وضعیت، شماره تلاش، کد پاسخ HTTP و خطای احتمالی.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {webhook && (
            <div dir="ltr" className="text-left text-xs text-ink-tertiary font-mono mb-3 truncate">
              {webhook.url}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="n-skeleton h-20 rounded-xl" />
              ))}
            </div>
          ) : deliveries.length === 0 ? (
            <EmptyState
              icon={History}
              title="هنوز تحویلی ثبت نشده"
              message="به‌محض ارسال اولین رویداد، اینجا نمایش داده می‌شود."
              size="compact"
            />
          ) : (
            <div className="space-y-2">
              {deliveries.map((d) => (
                <DeliveryRow key={d.id} delivery={d} />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function DeliveryRow({ delivery }: { delivery: WebhookDeliveryItem }) {
  return (
    <div className="rounded-lg border border-border p-2.5 text-xs">
      <div className="flex items-center justify-between gap-2 mb-1">
        <Badge variant="outline" className="text-[10px] font-mono">
          {delivery.eventType}
        </Badge>
        <DeliveryStatusBadge status={delivery.status} />
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-ink-tertiary">
        <span>
          تلاش: {toPersianDigits(delivery.attemptCount)}
        </span>
        {delivery.responseStatus !== null && (
          <span dir="ltr" className="font-mono">
            HTTP {toPersianDigits(delivery.responseStatus)}
          </span>
        )}
        <span>{toPersianDigits(formatJalali(new Date(delivery.createdAt)))}</span>
      </div>
      {delivery.lastError && (
        <p className="mt-1 text-[11px] text-danger line-clamp-2" title={delivery.lastError}>
          {delivery.lastError}
        </p>
      )}
    </div>
  )
}

function DeliveryStatusBadge({
  status,
}: {
  status: WebhookDeliveryItem['status']
}) {
  const map: Record<WebhookDeliveryItem['status'], { label: string; cls: string }> = {
    delivered: {
      label: 'تحویل شده',
      cls: 'bg-success-soft text-success border-transparent',
    },
    pending: { label: 'در انتظار', cls: 'bg-info-soft text-info border-transparent' },
    claimed: { label: 'در حال ارسال', cls: 'bg-info-soft text-info border-transparent' },
    retry_wait: {
      label: 'در انتظار تلاش مجدد',
      cls: 'bg-warning-soft text-warning border-transparent',
    },
    dead_letter: {
      label: 'بن‌بست',
      cls: 'bg-danger-soft text-danger border-transparent',
    },
    cancelled: { label: 'لغو شده', cls: '' },
  }
  const entry = map[status]
  return (
    <Badge variant={entry.cls ? 'default' : 'secondary'} className={entry.cls}>
      {entry.label}
    </Badge>
  )
}
