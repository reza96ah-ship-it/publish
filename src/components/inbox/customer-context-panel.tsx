'use client'

/**
 * Issue #248: Customer context panel.
 *
 * Right-side drawer for the inbox view. Given a customerId, fetches the
 * customer's profile (avatar, tags, notes), interaction timeline, and linked
 * cases. Designed to be mounted inside a Sheet/Drawer that already has the
 * customer ID — the parent passes `customerId` and this panel does the rest.
 *
 * Persian-first: all labels + empty states are in Persian. RTL-friendly via
 * the global `dir="rtl"` set on <html>.
 */

import { useCallback, useEffect, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { MessageCircle, Phone, Mail, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface CustomerDetail {
  id: string
  name: string
  email: string | null
  phone: string | null
  socialHandles: Record<string, string>
  avatarUrl: string | null
  tags: string[]
  notes: string | null
  consentStatus: string
  interactions: Array<{
    id: string
    type: string
    platform: string
    content: string
    direction: string
    createdAt: string
  }>
  cases: Array<{ id: string; title: string; status: string; role: string }>
}

interface Props {
  customerId: string
  onClose?: () => void
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: 'اینستاگرام',
  telegram: 'تلگرام',
  linkedin: 'لینکدین',
  rubika: 'روبیكا',
  bale: 'بله',
  eitaa: 'ایتا',
}

const TYPE_LABEL: Record<string, string> = {
  comment: 'کامنت',
  dm: 'پیام مستقیم',
  mention: 'منشن',
  reply: 'پاسخ',
}

const STATUS_LABEL: Record<string, string> = {
  open: 'باز',
  in_progress: 'در حال انجام',
  resolved: 'حل‌شده',
  closed: 'بسته‌شده',
}

const STATUS_COLOR: Record<string, string> = {
  open: 'bg-warning-soft text-warning',
  in_progress: 'bg-info-soft text-info',
  resolved: 'bg-success-soft text-success',
  closed: 'bg-surface-subtle text-ink-tertiary',
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function ConsentBadge({ status }: { status: string }) {
  if (status === 'granted') {
    return (
      <Badge variant="outline" className="gap-1 border-success/30 text-success">
        <CheckCircle2 className="size-3" /> رضایت داده
      </Badge>
    )
  }
  if (status === 'denied') {
    return (
      <Badge variant="outline" className="gap-1 border-danger/30 text-danger">
        <AlertTriangle className="size-3" /> عدم رضایت
      </Badge>
    )
  }
  return <Badge variant="outline" className="text-muted-foreground">رضایت نامشخص</Badge>
}

export function CustomerContextPanel({ customerId }: Props) {
  const [data, setData] = useState<CustomerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/customers/${customerId}`, { credentials: 'same-origin' })
      if (!res.ok) throw new Error('بارگذاری مشتری ناموفق بود')
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطای ناشناخته')
    } finally {
      setLoading(false)
    }
  }, [customerId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 text-sm text-destructive" role="alert">
        {error ?? 'مشتری یافت نشد'}
      </div>
    )
  }

  const initials = data.name.slice(0, 2)

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">
        {/* Header */}
        <header className="flex items-start gap-3">
          <Avatar className="size-12">
            {data.avatarUrl ? <AvatarImage src={data.avatarUrl} alt={data.name} /> : null}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold leading-tight">{data.name}</h3>
            <ConsentBadge status={data.consentStatus} />
          </div>
        </header>

        {/* Contact info */}
        <section className="space-y-1 text-sm">
          {data.email ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="size-4" /> <span dir="ltr">{data.email}</span>
            </div>
          ) : null}
          {data.phone ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-4" /> <span dir="ltr">{data.phone}</span>
            </div>
          ) : null}
          {Object.entries(data.socialHandles ?? {}).map(([platform, handle]) => (
            <div key={platform} className="flex items-center gap-2 text-muted-foreground">
              <MessageCircle className="size-4" />
              <span>{PLATFORM_LABEL[platform] ?? platform}:</span>
              <span dir="ltr">{handle}</span>
            </div>
          ))}
        </section>

        {/* Tags */}
        {data.tags.length > 0 ? (
          <section className="flex flex-wrap gap-1">
            {data.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
            ))}
          </section>
        ) : null}

        {/* Notes */}
        {data.notes ? (
          <section className="rounded-md border bg-muted/40 p-3 text-sm">
            <h4 className="mb-1 text-xs font-medium text-muted-foreground">یادداشت‌ها</h4>
            <p className="whitespace-pre-wrap leading-relaxed">{data.notes}</p>
          </section>
        ) : null}

        {/* Interaction timeline */}
        <section className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">آخرین تعامل‌ها</h4>
          {data.interactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">تعاملی ثبت نشده است.</p>
          ) : (
            <ol className="space-y-2">
              {data.interactions.map((i) => (
                <li key={i.id} className="rounded-md border p-2 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <Badge variant="outline" className="text-xs">
                      {TYPE_LABEL[i.type] ?? i.type} · {PLATFORM_LABEL[i.platform] ?? i.platform}
                    </Badge>
                    <time className="text-xs text-muted-foreground">{formatDate(i.createdAt)}</time>
                  </div>
                  <p
                    className={cn(
                      'leading-relaxed',
                      i.direction === 'outbound' ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {i.content}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Linked cases */}
        <section className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground">پرونده‌های مرتبط</h4>
          {data.cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">پرونده‌ای ثبت نشده است.</p>
          ) : (
            <ul className="space-y-1">
              {data.cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <span className="font-medium">{c.title}</span>
                  <span className={cn('rounded px-1.5 py-0.5 text-xs', STATUS_COLOR[c.status] ?? '')}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ScrollArea>
  )
}
