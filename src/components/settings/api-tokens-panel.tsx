'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Key, Plus, Trash2, Ban, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { LoadingState, EmptyState } from '@/components/dashboard/shared'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface ApiTokenItem {
  id: string
  name: string
  prefix: string
  scopes: string[]
  lastUsedAt: string | null
  expiresAt: string | null
  revokedAt: string | null
  createdAt: string
}

const ALL_SCOPES = [
  { value: 'content:read', label: 'خواندن محتوا' },
  { value: 'content:write', label: 'نوشتن محتوا' },
  { value: 'publications:read', label: 'خواندن انتشارها' },
  { value: 'inbox:read', label: 'خواندن صندوق' },
  { value: 'reports:read', label: 'خواندن گزارش‌ها' },
]

export function ApiTokensPanel() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>(['content:read'])
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const { data: tokens, isLoading, isError, refetch } = useQuery<ApiTokenItem[]>({
    queryKey: ['api-tokens'],
    queryFn: () => api.get<ApiTokenItem[]>('/api/api-tokens'),
  })

  const createMutation = useMutation({
    mutationFn: () => api.post<{ token: ApiTokenItem; plaintext: string }>('/api/api-tokens', { name, scopes }),
    onSuccess: (result) => {
      setPlaintext(result.plaintext)
      queryClient.invalidateQueries({ queryKey: ['api-tokens'] })
      toast.success('توکن ایجاد شد')
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'خطا در ایجاد توکن'),
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/api/api-tokens/${id}/revoke`),
    onSuccess: () => { toast.success('توکن باطل شد'); queryClient.invalidateQueries({ queryKey: ['api-tokens'] }) },
    onError: () => toast.error('خطا در ابطال توکن'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/api-tokens/${id}`),
    onSuccess: () => { toast.success('توکن حذف شد'); queryClient.invalidateQueries({ queryKey: ['api-tokens'] }) },
    onError: () => toast.error('خطا در حذف توکن'),
  })

  const handleCreate = () => {
    if (!name.trim()) { toast.error('نام توکن الزامی است'); return }
    if (scopes.length === 0) { toast.error('حداقل یک دسترسی الزامی است'); return }
    createMutation.mutate()
  }

  const resetForm = () => { setName(''); setScopes(['content:read']); setPlaintext(null); setCopied(false); setCreateOpen(false) }

  const copyToken = () => {
    if (plaintext) { navigator.clipboard.writeText(plaintext); setCopied(true); toast.success('کپی شد') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-ink-primary flex items-center gap-2"><Key className="size-4 text-accent" />توکن‌های API</h3>
          <p className="text-sm text-ink-secondary">توکن‌های دسترسی برای یکپارچه‌سازی با سرویس‌های خارجی</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" />ساخت توکن</Button>
      </div>

      <LoadingState isLoading={isLoading} isError={isError} onRetry={refetch} skeleton={<div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />)}</div>}>
        {tokens && tokens.length === 0 ? (
          <EmptyState icon={Key} title="هنوز توکنی ساخته نشده" message="برای اتصال به Zapier، Make یا n8n یک توکن API بسازید." />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
            {tokens?.map((t) => (
              <div key={t.id} className="n-card-compact flex items-center gap-3 p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-ink-primary">{t.name}</span>
                    <code className="text-2xs bg-surface-subtle px-1.5 py-0.5 rounded" dir="ltr">{t.prefix}…</code>
                    {t.revokedAt && <span className="text-2xs text-danger border border-danger/30 rounded px-1">باطل‌شده</span>}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.scopes.map((s) => (
                      <span key={s} className="text-2xs text-ink-tertiary bg-surface-subtle px-1.5 py-0.5 rounded">{s}</span>
                    ))}
                  </div>
                  <p className="text-2xs text-ink-tertiary mt-1">
                    {t.lastUsedAt ? `آخرین استفاده: ${formatJalali(new Date(t.lastUsedAt))}` : 'هرگز استفاده نشده'}
                  </p>
                </div>
                {!t.revokedAt && (
                  <Button variant="ghost" size="sm" onClick={() => revokeMutation.mutate(t.id)}><Ban className="size-3.5" />ابطال</Button>
                )}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-danger"><Trash2 className="size-3.5" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader><AlertDialogTitle>حذف توکن</AlertDialogTitle><AlertDialogDescription>آیا از حذف این توکن مطمئن هستید؟ این عمل قابل بازگشت نیست.</AlertDialogDescription></AlertDialogHeader>
                    <AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction className="bg-danger hover:bg-danger" onClick={() => deleteMutation.mutate(t.id)}>حذف</AlertDialogAction></AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </LoadingState>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={(o) => !o && resetForm()}>
        <DialogContent>
          {plaintext ? (
            <>
              <DialogHeader><DialogTitle>توکن شما</DialogTitle><DialogDescription>این توکن فقط یکبار نمایش داده می‌شود. آن را در جای امنی ذخیره کنید.</DialogDescription></DialogHeader>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-surface-subtle p-3 rounded-lg break-all" dir="ltr">{plaintext}</code>
                <Button variant="outline" size="icon" onClick={copyToken}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button>
              </div>
              <DialogFooter><Button onClick={resetForm}>بستن</Button></DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader><DialogTitle>ساخت توکن جدید</DialogTitle><DialogDescription>دسترسی‌های مورد نیاز را انتخاب کنید</DialogDescription></DialogHeader>
              <div className="space-y-3">
                <div><Label>نام توکن</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: Zapier" /></div>
                <div><Label>دسترسی‌ها</Label><div className="space-y-2">{ALL_SCOPES.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={scopes.includes(s.value)} onChange={(e) => setScopes(e.target.checked ? [...scopes, s.value] : scopes.filter((x) => x !== s.value))} />
                    <span className="text-sm">{s.label} <code className="text-2xs text-ink-tertiary" dir="ltr">{s.value}</code></span>
                  </label>
                ))}</div></div>
              </div>
              <DialogFooter><Button variant="ghost" onClick={resetForm}>انصراف</Button><Button onClick={handleCreate} disabled={createMutation.isPending}>ایجاد توکن</Button></DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
