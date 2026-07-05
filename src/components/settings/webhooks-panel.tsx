'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Webhook, Plus, Trash2, Copy, Check, Send, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/api'
import { formatJalali } from '@/lib/jalali'
import { LoadingState, EmptyState } from '@/components/dashboard/shared'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface WebhookItem {
  id: string; url: string; events: string[]; isActive: boolean
  lastTriggeredAt: string | null; lastResponseStatus: number | null; lastError: string | null; createdAt: string
}
interface DeliveryItem { id: string; eventType: string; status: string; attemptCount: number; responseStatus: number | null; lastError: string | null; deliveredAt: string | null; createdAt: string }

const EVENTS = ['publish.success', 'publish.failed', 'inbox.new', 'content.created', 'content.published']

export function WebhooksPanel() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>(['publish.success'])
  const [secret, setSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [historyId, setHistoryId] = useState<string | null>(null)

  const { data: hooks, isLoading, isError, refetch } = useQuery<WebhookItem[]>({ queryKey: ['webhooks'], queryFn: () => api.get<WebhookItem[]>('/api/webhooks') })
  const { data: deliveries } = useQuery<DeliveryItem[]>({ queryKey: ['webhook-deliveries', historyId], queryFn: () => api.get<DeliveryItem[]>(`/api/webhooks/${historyId}/deliveries`), enabled: !!historyId })

  const createMut = useMutation({
    mutationFn: () => api.post<{ webhook: WebhookItem; secret: string }>('/api/webhooks', { url, events }),
    onSuccess: (r) => { setSecret(r.secret); qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('وب‌هوک ایجاد شد') },
    onError: (e: unknown) => toast.error((e as Error).message || 'خطا'),
  })
  const toggleMut = useMutation({ mutationFn: (w: WebhookItem) => api.patch(`/api/webhooks/${w.id}`, { isActive: !w.isActive }), onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }), onError: () => toast.error('خطا') })
  const testMut = useMutation({ mutationFn: (id: string) => api.post(`/api/webhooks/${id}/test`), onSuccess: (r: unknown) => { const t = r as { ok: boolean; status: number }; t.ok ? toast.success('تست موفق بود') : toast.error(`خطا: HTTP ${t.status}`); qc.invalidateQueries({ queryKey: ['webhooks'] }) }, onError: () => toast.error('خطا در تست') })
  const deleteMut = useMutation({ mutationFn: (id: string) => api.delete(`/api/webhooks/${id}`), onSuccess: () => { toast.success('حذف شد'); qc.invalidateQueries({ queryKey: ['webhooks'] }) }, onError: () => toast.error('خطا') })

  const reset = () => { setUrl(''); setEvents(['publish.success']); setSecret(null); setCopied(false); setCreateOpen(false) }
  const copySecret = () => { if (secret) { navigator.clipboard.writeText(secret); setCopied(true); toast.success('کپی شد') } }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h3 className="text-base font-semibold text-ink-primary flex items-center gap-2"><Webhook className="size-4 text-accent" />وب‌هوک‌ها</h3><p className="text-sm text-ink-secondary">رویدادها را به آدرس‌های خارجی ارسال کنید</p></div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" />افزودن وب‌هوک</Button>
      </div>
      <LoadingState isLoading={isLoading} isError={isError} onRetry={refetch} skeleton={<div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />)}</div>}>
        {hooks && hooks.length === 0 ? (
          <EmptyState icon={Webhook} title="هنوز وب‌هوکی ثبت نشده" message="با ثبت وب‌هوک، رویدادها به صورت خودکار به آدرس شما ارسال می‌شوند." />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto thin-scrollbar">
            {hooks?.map((w) => (
              <div key={w.id} className="n-card-compact p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <code className="flex-1 text-xs text-ink-secondary truncate" dir="ltr">{w.url}</code>
                  <Switch checked={w.isActive} onCheckedChange={() => toggleMut.mutate(w)} aria-label="فعال/غیرفعال" />
                  <Button variant="ghost" size="sm" onClick={() => testMut.mutate(w.id)}><Send className="size-3.5" />تست</Button>
                  <Button variant="ghost" size="sm" onClick={() => setHistoryId(w.id)}><History className="size-3.5" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-danger"><Trash2 className="size-3.5" /></Button></AlertDialogTrigger>
                    <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>حذف وب‌هوک</AlertDialogTitle><AlertDialogDescription>آیا مطمئن هستید؟</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>انصراف</AlertDialogCancel><AlertDialogAction className="bg-danger hover:bg-danger" onClick={() => deleteMut.mutate(w.id)}>حذف</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                  </AlertDialog>
                </div>
                <div className="flex flex-wrap gap-1">{w.events.map((e) => <span key={e} className="text-2xs text-ink-tertiary bg-surface-subtle px-1.5 py-0.5 rounded" dir="ltr">{e}</span>)}</div>
                {w.lastTriggeredAt && <p className="text-2xs text-ink-tertiary">آخرین ارسال: {formatJalali(new Date(w.lastTriggeredAt))} {w.lastResponseStatus && `(${w.lastResponseStatus})`}</p>}
                {w.lastError && <p className="text-2xs text-danger">{w.lastError}</p>}
              </div>
            ))}
          </div>
        )}
      </LoadingState>

      <Dialog open={createOpen} onOpenChange={(o) => !o && reset()}>
        <DialogContent>
          {secret ? (
            <><DialogHeader><DialogTitle>راز وب‌هوک</DialogTitle><DialogDescription>این راز فقط یکبار نمایش داده می‌شود. برای تأیید امضای HMAC از آن استفاده کنید.</DialogDescription></DialogHeader>
            <div className="flex items-center gap-2"><code className="flex-1 text-xs bg-surface-subtle p-3 rounded-lg break-all" dir="ltr">{secret}</code><Button variant="outline" size="icon" onClick={copySecret}>{copied ? <Check className="size-4" /> : <Copy className="size-4" />}</Button></div>
            <DialogFooter><Button onClick={reset}>بستن</Button></DialogFooter></>
          ) : (
            <><DialogHeader><DialogTitle>افزودن وب‌هوک</DialogTitle><DialogDescription>آدرس باید HTTPS باشد</DialogDescription></DialogHeader>
            <div className="space-y-3">
              <div><Label>آدرس URL</Label><Input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/webhook" /></div>
              <div><Label>رویدادها</Label><div className="space-y-2">{EVENTS.map((e) => <label key={e} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={events.includes(e)} onChange={(ev) => setEvents(ev.target.checked ? [...events, e] : events.filter((x) => x !== e))} /><code className="text-sm" dir="ltr">{e}</code></label>)}</div></div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={reset}>انصراف</Button><Button onClick={() => createMut.mutate()} disabled={createMut.isPending || !url.trim()}>ایجاد</Button></DialogFooter></>
          )}
        </DialogContent>
      </Dialog>

      <Sheet open={!!historyId} onOpenChange={(o) => !o && setHistoryId(null)}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>تاریخچه تحویل</SheetTitle></SheetHeader>
          <div className="space-y-2 mt-4">
            {deliveries?.map((d) => (
              <div key={d.id} className="n-card-compact p-3 text-xs space-y-1">
                <div className="flex items-center justify-between"><code dir="ltr">{d.eventType}</code><span className={d.status === 'delivered' ? 'text-success' : d.status === 'dead_letter' ? 'text-danger' : 'text-ink-tertiary'}>{d.status}</span></div>
                <p className="text-ink-tertiary">تلاش: {d.attemptCount} {d.responseStatus && `| HTTP ${d.responseStatus}`}</p>
                {d.lastError && <p className="text-danger">{d.lastError}</p>}
                <p className="text-ink-tertiary">{formatJalali(new Date(d.createdAt))}</p>
              </div>
            ))}
            {deliveries && deliveries.length === 0 && <p className="text-sm text-ink-tertiary text-center py-4">موردی یافت نشد</p>}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
