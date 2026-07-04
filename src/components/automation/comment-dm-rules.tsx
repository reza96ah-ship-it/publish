'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight, Eye, Globe, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { previewTemplate } from '@/modules/automation/comment-dm-shared'
import type { CommentDmRule } from '@/modules/automation/comment-dm-shared'
import { cn } from '@/lib/utils'

interface Platform {
  id: string
  name: string
  type: string
}

interface Props {
  platforms: Platform[]
  /** When set, rules are scoped to this publication; null = workspace-wide view */
  publicationId?: string | null
  /** Pre-fill keyword from caption detection */
  suggestedKeyword?: string | null
}

export function CommentDmRulesPanel({ platforms, publicationId, suggestedKeyword }: Props) {
  const queryClient = useQueryClient()
  const igPlatforms = platforms.filter((p) => p.type === 'instagram')
  const isPerPost = publicationId != null

  const [showForm, setShowForm] = useState(!!suggestedKeyword)
  const [platformId, setPlatformId] = useState(igPlatforms[0]?.id ?? '')
  const [keyword, setKeyword] = useState(suggestedKeyword ?? '')
  const [dmTemplate, setDmTemplate] = useState('')
  const [publicReply, setPublicReply] = useState('پیام شما را به DM فرستادم ✉️')
  const [optOutKeyword, setOptOutKeyword] = useState('نه')
  const [freqCapHours, setFreqCapHours] = useState(24)
  const [previewName, setPreviewName] = useState('آرش')

  const queryKey = isPerPost
    ? ['comment-dm-rules', publicationId]
    : ['comment-dm-rules']

  const apiUrl = isPerPost
    ? `/api/automation/comment-dm-rules?publicationId=${publicationId}`
    : '/api/automation/comment-dm-rules'

  const { data: rules, isLoading, error } = useQuery<CommentDmRule[]>({
    queryKey,
    queryFn: () => api.get<CommentDmRule[]>(apiUrl),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/automation/comment-dm-rules', {
      platformId,
      keyword,
      dmTemplate,
      publicReply: publicReply || null,
      optOutKeyword,
      freqCapHours,
      publicationId: publicationId ?? null,
    }),
    onSuccess: () => {
      toast.success('قانون کامنت→DM ایجاد شد')
      queryClient.invalidateQueries({ queryKey })
      setShowForm(false)
      setKeyword(suggestedKeyword ?? '')
      setDmTemplate('')
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'خطا'),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/automation/comment-dm-rules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error('خطا در تغییر وضعیت'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/automation/comment-dm-rules/${id}`),
    onSuccess: () => {
      toast.success('قانون حذف شد')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('خطا در حذف'),
  })

  // Feature not enabled → 403 from API
  if (error && (error as Error).message?.includes('بتا')) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">قابلیت کامنت→DM در مرحله بتا است و برای این فضای کار فعال نشده.</p>
      </div>
    )
  }

  if (igPlatforms.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">برای استفاده از کامنت→DM ابتدا یک حساب اینستاگرام متصل کنید.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-primary flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            کامنت → پیام مستقیم
            {isPerPost
              ? <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><FileText className="size-3" /> مختص این پست</span>
              : <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><Globe className="size-3" /> تمام پست‌ها</span>
            }
          </h3>
          <p className="text-sm text-ink-secondary">کامنت حاوی کلیدواژه → ارسال خودکار DM (بتا)</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="size-4" />
            قانون جدید
          </Button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="n-card p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>حساب اینستاگرام</Label>
              <select
                value={platformId}
                onChange={(e) => setPlatformId(e.target.value)}
                className="n-control w-full text-sm h-10 px-3 rounded-lg"
              >
                {igPlatforms.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>کلیدواژه فارسی</Label>
              <Input
                dir="rtl"
                placeholder="مثال: قیمت"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>متن پیام مستقیم</Label>
            <Textarea
              dir="rtl"
              rows={3}
              placeholder={'سلام {نام}! لطفاً DM ما را ببینید…\n\nبرای لغو اشتراک عبارت «نه» را بفرستید.'}
              value={dmTemplate}
              onChange={(e) => setDmTemplate(e.target.value)}
            />
            <p className="text-xs text-ink-tertiary">متغیر: &#x7B;نام&#x7D; با نام کاربر جایگزین می‌شود</p>
          </div>

          <div className="space-y-1.5">
            <Label>پاسخ عمومی زیر کامنت (اختیاری)</Label>
            <Input
              dir="rtl"
              placeholder="مثال: پیام شما را به DM فرستادم ✉️"
              value={publicReply}
              onChange={(e) => setPublicReply(e.target.value)}
            />
            <p className="text-xs text-ink-tertiary">این پیام به صورت ریپلای عمومی زیر کامنت کاربر نمایش داده می‌شود</p>
          </div>

          {/* Preview */}
          {dmTemplate && (
            <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="size-3.5 text-ink-tertiary" />
                <span className="text-xs text-ink-tertiary">پیش‌نمایش DM</span>
                <Input
                  className="h-6 text-xs w-24 ms-auto"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="نام"
                />
              </div>
              <p className="text-sm text-ink-primary whitespace-pre-wrap">{previewTemplate(dmTemplate, previewName)}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>کلیدواژه انصراف</Label>
              <Input dir="rtl" value={optOutKeyword} onChange={(e) => setOptOutKeyword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>کمترین فاصله (ساعت)</Label>
              <Input
                type="number"
                min={1}
                max={168}
                value={freqCapHours}
                onChange={(e) => setFreqCapHours(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>انصراف</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={!keyword || !dmTemplate || createMutation.isPending}
            >
              ذخیره قانون
            </Button>
          </div>
        </div>
      )}

      {/* Rule list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />)}</div>
      ) : (rules ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-ink-tertiary text-center py-4">هنوز قانونی تعریف نشده</p>
      ) : (
        <div className="space-y-2">
          {(rules ?? []).map((rule) => (
            <div key={rule.id} className={cn('n-card-compact flex items-center gap-3 p-3', !rule.isActive && 'opacity-60')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-ink-primary">«{rule.keyword}»</span>
                  <span className="text-2xs text-ink-tertiary">→ DM</span>
                  <span className="text-2xs text-ink-tertiary border border-border rounded px-1">{rule.platformName}</span>
                  {rule.publicationId
                    ? <span className="text-2xs text-accent border border-accent/30 rounded px-1 flex items-center gap-0.5"><FileText className="size-2.5" />این پست</span>
                    : <span className="text-2xs text-ink-tertiary border border-border rounded px-1 flex items-center gap-0.5"><Globe className="size-2.5" />همه پست‌ها</span>
                  }
                </div>
                <p className="text-xs text-ink-secondary truncate mt-0.5">{rule.dmTemplate}</p>
              </div>
              <button
                onClick={() => toggleMutation.mutate({ id: rule.id, isActive: !rule.isActive })}
                className="n-focus-ring shrink-0 text-ink-tertiary hover:text-ink-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={rule.isActive ? 'غیرفعال کردن' : 'فعال کردن'}
              >
                {rule.isActive ? <ToggleRight className="size-5 text-success" /> : <ToggleLeft className="size-5" />}
              </button>
              <button
                onClick={() => deleteMutation.mutate(rule.id)}
                className="n-focus-ring shrink-0 text-danger hover:text-danger/80 min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="حذف"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
