'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface RecoverableJob {
  id: string
  status: string
  error: string | null
  publicationId: string | null
  reconciliationStatus: string | null
  publicationError: string | null
  canResolve: boolean
}

export function PublicationRecovery({ job }: { job: RecoverableJob }) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<'mark_published' | 'confirm_failure'>('mark_published')
  const [providerPostId, setProviderPostId] = useState('')
  const [reason, setReason] = useState('')
  const unknown = job.reconciliationStatus === 'still_unknown'
  const retryable = !unknown && job.reconciliationStatus !== 'confirmed_success' &&
    (job.status === 'failed' || (job.status === 'action' && job.reconciliationStatus === 'confirmed_failure'))

  const retry = useMutation({
    mutationFn: () => api.patch(`/api/publish-jobs/${job.id}`, { action: 'retry' }),
    onSuccess: () => {
      toast.success('انتشار دوباره به صف بازگردانده شد')
      void queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: () => toast.error('تلاش مجدد ممکن نشد؛ وضعیت انتشار را دوباره بررسی کنید'),
  })
  const resolve = useMutation({
    mutationFn: () => api.post(`/api/publications/${job.publicationId}/resolve`, {
      action,
      providerPostId: action === 'mark_published' ? providerPostId.trim() : undefined,
      reason: reason.trim(),
    }),
    onSuccess: () => {
      toast.success('وضعیت انتشار ثبت شد')
      setOpen(false)
      setReason('')
      setProviderPostId('')
      void queryClient.invalidateQueries({ queryKey: ['publish-jobs'] })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
    onError: () => toast.error('ثبت نتیجه ممکن نشد؛ ممکن است وضعیت انتشار تغییر کرده باشد'),
  })

  if (!unknown && !retryable && !job.error && !job.publicationError) return null
  return (
    <div className="mt-2 space-y-2 text-xs" aria-live="polite">
      {(job.publicationError || job.error) && (
        <p className="text-warning break-words">{job.publicationError || job.error}</p>
      )}
      {unknown ? (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-2 space-y-2">
          <p className="text-warning">نتیجه انتشار نامشخص است. تلاش مجدد تا بررسی دستی مسدود است تا پست تکراری ساخته نشود.</p>
          {job.canResolve && job.publicationId ? (
            <Button size="sm" variant="outline" onClick={() => setOpen(true)}>بررسی و حل دستی</Button>
          ) : <p className="text-ink-tertiary">از مدیر فضای کاری بخواهید نتیجه را در اینستاگرام و Zernio بررسی کند.</p>}
        </div>
      ) : retryable ? (
        <Button size="sm" variant="outline" disabled={retry.isPending} onClick={() => retry.mutate()}>
          {retry.isPending ? 'در حال ثبت…' : 'تلاش مجدد انتشار'}
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>حل وضعیت نامشخص انتشار</DialogTitle>
            <DialogDescription>
              ابتدا همین پست را در حساب اینستاگرام و Zernio بررسی کنید. این فرم خودش انتشار خارجی را تأیید نمی‌کند و هیچ پستی را دوباره ارسال نمی‌کند.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant={action === 'mark_published' ? 'default' : 'outline'} onClick={() => setAction('mark_published')}>پست منتشر شده است</Button>
              <Button type="button" size="sm" variant={action === 'confirm_failure' ? 'default' : 'outline'} onClick={() => setAction('confirm_failure')}>پست منتشر نشده است</Button>
            </div>
            {action === 'mark_published' && (
              <div className="space-y-1">
                <Label htmlFor={`provider-post-${job.id}`}>شناسه پست اینستاگرام</Label>
                <Input id={`provider-post-${job.id}`} value={providerPostId} onChange={(event) => setProviderPostId(event.target.value)} dir="ltr" autoComplete="off" />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor={`resolution-reason-${job.id}`}>دلیل و شواهد بررسی (حداقل ۱۰ نویسه)</Label>
              <Textarea id={`resolution-reason-${job.id}`} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>انصراف</Button>
            <Button type="button" disabled={resolve.isPending || reason.trim().length < 10 || (action === 'mark_published' && !providerPostId.trim())} onClick={() => resolve.mutate()}>
              {resolve.isPending ? 'در حال ثبت…' : 'ثبت نتیجه بررسی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
