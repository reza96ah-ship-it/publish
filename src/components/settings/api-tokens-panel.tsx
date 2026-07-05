'use client'

/**
 * Issue #255: API tokens admin panel (settings → API).
 *
 * Lists all API tokens issued for the workspace, lets the admin create new
 * tokens (with name + scopes + optional expiry), shows the plaintext ONCE on
 * creation in a copy-to-clipboard box, and supports soft-revoke (sets
 * revokedAt, retains audit trail) and hard-delete (irreversible).
 *
 * The plaintext token is shown ONLY in the create response — neither the
 * list nor any subsequent fetch returns it. If the admin loses the plaintext
 * they must rotate (revoke + create new). Token hashes are never displayed.
 *
 * Backend:
 *   GET    /api/api-tokens              — list (no hashes)
 *   POST   /api/api-tokens              — create, returns { token, plaintext } (201)
 *   POST   /api/api-tokens/[id]/revoke  — soft-revoke
 *   DELETE /api/api-tokens/[id]         — hard-delete (204)
 */

import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Key, Plus, Trash2, Ban, Copy, Check, AlertTriangle } from 'lucide-react'

import { api } from '@/lib/api'
import { announce } from '@/lib/aria-live'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { LoadingState, EmptyState } from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { JalaliDatePicker } from '@/components/ui/jalali-picker'
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

// ── Types ────────────────────────────────────────────────────────────────────

interface ApiTokenItem {
  id: string
  name: string
  prefix: string // `nsh_aB3xY9zK` — first 12 chars of plaintext for UI display
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

interface CreateApiTokenResult {
  token: ApiTokenItem
  plaintext: string
}

const SCOPES: { value: string; label: string; desc: string }[] = [
  { value: 'content:read', label: 'خواندن محتوا', desc: 'GET /api/v1/content' },
  { value: 'content:write', label: 'نوشتن محتوا', desc: 'ایجاد/ویرایش محتوا' },
  { value: 'publications:read', label: 'خواندن انتشارها', desc: 'GET /api/v1/publications' },
  { value: 'inbox:read', label: 'خواندن صندوق ورودی', desc: 'GET /api/v1/inbox' },
  { value: 'reports:read', label: 'خواندن گزارش‌ها', desc: 'GET /api/v1/reports' },
]

// ── Panel ────────────────────────────────────────────────────────────────────

export function ApiTokensPanel() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [newPlaintext, setNewPlaintext] = useState<string | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ApiTokenItem | null>(null)

  const { data: tokens = [], isLoading } = useQuery<ApiTokenItem[]>({
    queryKey: ['api-tokens'],
    queryFn: () => api.get<ApiTokenItem[]>('/api/api-tokens'),
  })

  const createMutation = useMutation({
    mutationFn: (input: { name: string; scopes: string[]; expiresAt: string | null }) =>
      api.post<CreateApiTokenResult>('/api/api-tokens', input),
    onSuccess: (res) => {
      setNewPlaintext(res.plaintext)
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
      toast.success('توکن ساخته شد')
      announce('توکن جدید ساخته شد')
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در ساخت توکن')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/api-tokens/${id}/revoke`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['api-tokens'] })
      const prev = qc.getQueryData<ApiTokenItem[]>(['api-tokens'])
      qc.setQueryData<ApiTokenItem[]>(['api-tokens'], (old) =>
        old
          ? old.map((t) => (t.id === id ? { ...t, revokedAt: new Date().toISOString() } : t))
          : old
      )
      return { prev }
    },
    onSuccess: () => {
      toast.success('توکن ابطال شد')
      announce('توکن ابطال شد')
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['api-tokens'], ctx.prev)
      toast.error(err.message || 'خطا در ابطال توکن')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-tokens/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['api-tokens'] })
      const prev = qc.getQueryData<ApiTokenItem[]>(['api-tokens'])
      qc.setQueryData<ApiTokenItem[]>(['api-tokens'], (old) =>
        old ? old.filter((t) => t.id !== id) : old
      )
      return { prev }
    },
    onSuccess: () => {
      toast.success('توکن حذف شد')
      announce('توکن حذف شد')
    },
    onError: (err: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(['api-tokens'], ctx.prev)
      toast.error(err.message || 'خطا در حذف توکن')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['api-tokens'] })
    },
  })

  return (
    <div className="space-y-4">
      <div className="n-card p-5">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Key className="size-4 text-accent" />
            <h2 className="text-lg font-semibold text-ink-primary">توکن‌های API</h2>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            ساخت توکن جدید
          </Button>
        </div>
        <p className="text-xs text-ink-tertiary mb-4">
          توکن‌های دسترسی برای اتصال سرویس‌های بیرونی (Zapier، n8n، اسکریپت‌های سفارشی) به API
          نسخه ۱. متن توکن فقط یک‌بار هنگام ساخت نمایش داده می‌شود — آن را در جای امنی ذخیره کنید.
        </p>

        <LoadingState
          isLoading={isLoading}
          skeleton={
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="n-skeleton h-20 rounded-xl" />
              ))}
            </div>
          }
        >
          {tokens.length === 0 ? (
            <EmptyState
              icon={Key}
              title="هنوز توکنی ساخته نشده"
              message="برای اتصال سرویس بیرونی، اولین توکن API خود را بسازید."
              size="compact"
            />
          ) : (
            <div className="space-y-2">
              {tokens.map((t) => (
                <TokenRow
                  key={t.id}
                  token={t}
                  onRevoke={() => setRevokeTarget(t)}
                  onDelete={() => setDeleteTarget(t)}
                />
              ))}
            </div>
          )}
        </LoadingState>
      </div>

      <CreateTokenDialog
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o && !newPlaintext) {
            // closed without creating — keep form state clean for next open
          }
        }}
        pending={createMutation.isPending}
        onCreate={(input) => createMutation.mutate(input)}
      />

      {/* Plaintext reveal — shown once after successful create */}
      <Dialog
        open={!!newPlaintext}
        onOpenChange={(o) => {
          if (!o) setNewPlaintext(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-start flex items-center gap-2">
              <AlertTriangle className="size-5 text-warning" />
              توکن ساخته شد
            </DialogTitle>
            <DialogDescription className="text-start">
              این توکن فقط یک‌بار نمایش داده می‌شود. آن را همین حالا در جای امنی ذخیره کنید — در
              صورت گم شدن، باید آن را ابطال کرده و توکن جدید بسازید.
            </DialogDescription>
          </DialogHeader>
          <CopyableSecret value={newPlaintext ?? ''} />
          <DialogFooter>
            <Button onClick={() => setNewPlaintext(null)}>متوجه شدم</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirm */}
      <AlertDialog
        open={!!revokeTarget}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ابطال توکن «{revokeTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              توکن ابطال‌شده دیگر قابل استفاده نیست ولی سابقه آن برای بررسی نگه داشته می‌شود. این
              عملیات قابل بازگشت نیست.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-white hover:bg-warning/90"
              onClick={() => {
                if (revokeTarget) revokeMutation.mutate(revokeTarget.id)
                setRevokeTarget(null)
              }}
            >
              ابطال کن
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف توکن «{deleteTarget?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>
              حذف، سابقه توکن را به‌طور کامل پاک می‌کند (مناسب درخواست‌های GDPR). این عملیات قابل
              بازگشت نیست. برای توقف موقت دسترسی، به‌جای حذف از «ابطال» استفاده کنید.
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
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function TokenRow({
  token,
  onRevoke,
  onDelete,
}: {
  token: ApiTokenItem
  onRevoke: () => void
  onDelete: () => void
}) {
  const revoked = !!token.revokedAt
  const expired = token.expiresAt ? new Date(token.expiresAt) < new Date() : false
  const status = revoked ? 'revoked' : expired ? 'expired' : 'active'

  return (
    <div className="rounded-xl border border-border p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <p className="text-sm font-semibold text-ink-primary truncate">{token.name}</p>
            <StatusBadge status={status} />
          </div>
          <p dir="ltr" className="text-left text-xs text-ink-tertiary font-mono truncate">
            {token.prefix}…
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {token.scopes.map((s) => (
              <Badge key={s} variant="outline" className="text-[10px] font-mono">
                {s}
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-tertiary">
            <span>ساخته‌شده: {toPersianDigits(formatJalali(new Date(token.createdAt)))}</span>
            {token.lastUsedAt && (
              <span>
                آخرین استفاده: {toPersianDigits(formatJalali(new Date(token.lastUsedAt)))}
              </span>
            )}
            {token.expiresAt && (
              <span>
                انقضا: {toPersianDigits(formatJalali(new Date(token.expiresAt)))}
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {!revoked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRevoke}
              aria-label="ابطال توکن"
              title="ابطال"
            >
              <Ban className="size-4" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            aria-label="حذف توکن"
            title="حذف"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: 'active' | 'revoked' | 'expired' }) {
  if (status === 'active')
    return (
      <Badge className="bg-success-soft text-success border-transparent">فعال</Badge>
    )
  if (status === 'revoked')
    return (
      <Badge className="bg-warning-soft text-warning border-transparent">ابطال‌شده</Badge>
    )
  return <Badge variant="secondary">منقضی</Badge>
}

function CreateTokenDialog({
  open,
  onOpenChange,
  pending,
  onCreate,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  pending: boolean
  onCreate: (input: { name: string; scopes: string[]; expiresAt: string | null }) => void
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['content:read'])
  const [expiresAt, setExpiresAt] = useState<Date | null>(null)

  function toggleScope(s: string) {
    setScopes((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  function handleClose(o: boolean) {
    if (!o) {
      setName('')
      setScopes(['content:read'])
      setExpiresAt(null)
    }
    onOpenChange(o)
  }

  function submit() {
    if (!name.trim()) {
      toast.error('نام توکن الزامی است')
      return
    }
    if (scopes.length === 0) {
      toast.error('حداقل یک دسترسی الزامی است')
      return
    }
    onCreate({
      name: name.trim(),
      scopes,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-start">ساخت توکن API جدید</DialogTitle>
          <DialogDescription className="text-start">
            دسترسی‌های موردنیاز را انتخاب کنید. پس از ساخت، متن توکن فقط یک‌بار نمایش داده
            می‌شود.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">نام توکن</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثلاً: اتصال Zapier"
              maxLength={100}
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">دسترسی‌ها (Scopes)</Label>
            <div className="space-y-2">
              {SCOPES.map((s) => (
                <label
                  key={s.value}
                  className="flex items-start gap-2 rounded-lg border border-border p-2 cursor-pointer hover:bg-surface-hover transition-colors"
                >
                  <Checkbox
                    checked={scopes.includes(s.value)}
                    onCheckedChange={() => toggleScope(s.value)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-primary">{s.label}</p>
                    <p dir="ltr" className="text-left text-[11px] text-ink-tertiary font-mono">
                      {s.desc}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">
              تاریخ انقضا (اختیاری)
            </Label>
            <JalaliDatePicker
              value={expiresAt}
              onChange={setExpiresAt}
              placeholder="بدون انقضا"
              disablePast
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)}>
            انصراف
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? 'در حال ساخت…' : 'ساخت توکن'}
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
      announce('توکن در کلیپ‌بورد کپی شد')
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
        {copied ? 'کپی شد' : 'کپی متن توکن'}
      </Button>
    </div>
  )
}
