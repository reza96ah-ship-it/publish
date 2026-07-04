'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Eye, Globe, FileText,
  ShieldCheck, MousePointerClick, FlaskConical, CheckCircle2, XCircle, MinusCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/api'
import { previewTemplate, parseKeywordList, matchComment } from '@/modules/automation/comment-dm-shared'
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
  /** Monitor mode: list-only, no creation form (used in Settings) */
  readOnly?: boolean
}

const STATUS_LABELS: Record<string, string> = {
  active: 'فعال',
  paused: 'متوقف',
  draft: 'پیش‌نویس',
  needs_attention: 'نیازمند بررسی',
}

export function CommentDmRulesPanel({ platforms, publicationId, suggestedKeyword, readOnly = false }: Props) {
  const queryClient = useQueryClient()
  const igPlatforms = platforms.filter((p) => p.type === 'instagram')
  const isPerPost = publicationId != null

  const [showForm, setShowForm] = useState(!readOnly && !!suggestedKeyword)
  const [platformId, setPlatformId] = useState(igPlatforms[0]?.id ?? '')
  const [keywordsRaw, setKeywordsRaw] = useState(suggestedKeyword ?? '')
  const [excludeRaw, setExcludeRaw] = useState('')
  const [dmTemplate, setDmTemplate] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [publicReply, setPublicReply] = useState('پیام شما را به دایرکت فرستادم ✉️')
  const [optOutKeyword, setOptOutKeyword] = useState('نه')
  const [previewName, setPreviewName] = useState('آرش')
  const [testComment, setTestComment] = useState('')

  const queryKey = isPerPost ? ['comment-dm-rules', publicationId] : ['comment-dm-rules']
  const apiUrl = isPerPost
    ? `/api/automation/comment-dm-rules?publicationId=${publicationId}`
    : '/api/automation/comment-dm-rules'

  const { data: rules, isLoading, error } = useQuery<CommentDmRule[]>({
    queryKey,
    queryFn: () => api.get<CommentDmRule[]>(apiUrl),
    retry: false,
  })

  const keywords = useMemo(() => parseKeywordList(keywordsRaw), [keywordsRaw])
  const excludeKeywords = useMemo(() => parseKeywordList(excludeRaw), [excludeRaw])
  const testResult = useMemo(
    () => (testComment.trim() ? matchComment(testComment, keywords, excludeKeywords) : null),
    [testComment, keywords, excludeKeywords]
  )

  const resetForm = () => {
    setKeywordsRaw(suggestedKeyword ?? '')
    setExcludeRaw('')
    setDmTemplate('')
    setButtonText('')
    setButtonUrl('')
    setTestComment('')
  }

  const createMutation = useMutation({
    mutationFn: () => api.post('/api/automation/comment-dm-rules', {
      platformId,
      keywords,
      excludeKeywords,
      dmTemplate,
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      publicReply: publicReply || null,
      optOutKeyword,
      publicationId: publicationId ?? null,
    }),
    onSuccess: () => {
      toast.success('اتوماسیون ذخیره شد')
      queryClient.invalidateQueries({ queryKey })
      setShowForm(false)
      resetForm()
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'مشکلی پیش آمد'),
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
      toast.success('اتوماسیون حذف شد')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('خطا در حذف'),
  })

  // Feature not enabled → 403 from API
  if (error && (error as Error).message?.includes('بتا')) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">قابلیت کامنت به دایرکت در مرحله بتا است و برای این فضای کار فعال نشده.</p>
      </div>
    )
  }

  if (igPlatforms.length === 0 && !readOnly) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">برای استفاده از کامنت به دایرکت ابتدا یک حساب اینستاگرام متصل کنید.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-primary flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            اتوماسیون کامنت به دایرکت
            {!readOnly && (isPerPost
              ? <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><FileText className="size-3" /> مختص این پست</span>
              : <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><Globe className="size-3" /> همه پست‌ها</span>
            )}
          </h3>
          <p className="text-sm text-ink-secondary">
            {readOnly
              ? 'همه اتوماسیون‌های ساخته‌شده — برای ساخت اتوماسیون جدید هنگام ساخت پست اقدام کنید'
              : 'وقتی مخاطب کلمه‌ای مثل «قیمت» زیر پست شما بنویسد، پیام آماده در دایرکت ارسال می‌شود'}
          </p>
        </div>
        {!readOnly && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0">
            <Plus className="size-4" />
            ساخت اتوماسیون
          </Button>
        )}
      </div>

      {/* Compliance note — the three rules users must understand */}
      {!readOnly && (
        <div className="rounded-lg border border-border bg-surface-subtle p-3 flex items-start gap-2">
          <ShieldCheck className="size-4 text-ink-tertiary shrink-0 mt-0.5" />
          <p className="text-xs text-ink-tertiary leading-relaxed">
            طبق قوانین اینستاگرام: برای هر کامنت فقط یک پیام دایرکت خودکار ارسال می‌شود، آن هم تا ۷ روز پس از ثبت کامنت.
            اگر کاربر کلمه انصراف را بنویسد، پیامی ارسال نمی‌شود.
          </p>
        </div>
      )}

      {/* Create form */}
      {!readOnly && showForm && (
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
              <Label>وقتی کامنت شامل این کلمه‌ها بود</Label>
              <Input
                dir="rtl"
                placeholder="مثال: قیمت، خرید، لینک"
                value={keywordsRaw}
                onChange={(e) => setKeywordsRaw(e.target.value)}
              />
              <p className="text-xs text-ink-tertiary">چند کلمه را با ویرگول جدا کنید — هر کدام دیده شد، پیام ارسال می‌شود</p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>پیام دایرکت</Label>
            <Textarea
              dir="rtl"
              rows={3}
              placeholder={'سلام {نام} عزیز 👋\nقیمت و جزئیات رو اینجا برات گذاشتم…'}
              value={dmTemplate}
              onChange={(e) => setDmTemplate(e.target.value)}
            />
            <p className="text-xs text-ink-tertiary">متغیر: &#x7B;نام&#x7D; با نام کاربر جایگزین می‌شود</p>
          </div>

          {/* Quick-reply button — tapping it opens the 24h window for follow-ups */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <MousePointerClick className="size-3.5 text-ink-tertiary" />
                متن دکمه پاسخ سریع (اختیاری)
              </Label>
              <Input dir="rtl" placeholder="مثال: دریافت لینک 🔗" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>لینک دکمه</Label>
              <Input dir="ltr" placeholder="https://…" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-ink-tertiary -mt-1">
            وقتی کاربر روی دکمه بزند، پنجره ۲۴ ساعته گفت‌وگو باز می‌شود و می‌توانید ادامه دهید.
          </p>

          <div className="space-y-1.5">
            <Label>پاسخ عمومی زیر کامنت (اختیاری)</Label>
            <Input
              dir="rtl"
              placeholder="مثال: پیام شما را به دایرکت فرستادم ✉️"
              value={publicReply}
              onChange={(e) => setPublicReply(e.target.value)}
            />
          </div>

          {/* DM preview */}
          {dmTemplate && (
            <div className="rounded-lg border border-border bg-surface-subtle p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Eye className="size-3.5 text-ink-tertiary" />
                <span className="text-xs text-ink-tertiary">پیش‌نمایش دایرکت</span>
                <Input
                  className="h-6 text-xs w-24 ms-auto"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="نام"
                />
              </div>
              <p className="text-sm text-ink-primary whitespace-pre-wrap">{previewTemplate(dmTemplate, previewName)}</p>
              {buttonText && (
                <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 text-accent text-xs px-3 py-1">
                  <MousePointerClick className="size-3" />
                  {buttonText}
                </span>
              )}
            </div>
          )}

          {/* Exclude keywords + opt-out */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>کلمه‌های نادیده‌گرفته‌شده (اختیاری)</Label>
              <Input dir="rtl" placeholder="مثال: گران، بد" value={excludeRaw} onChange={(e) => setExcludeRaw(e.target.value)} />
              <p className="text-xs text-ink-tertiary">اگر کامنت شامل این کلمه‌ها بود، پیام ارسال نمی‌شود</p>
            </div>
            <div className="space-y-1.5">
              <Label>اگر کاربر این کلمه را گفت، پیام ارسال نشود</Label>
              <Input dir="rtl" value={optOutKeyword} onChange={(e) => setOptOutKeyword(e.target.value)} />
            </div>
          </div>

          {/* Test runner */}
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FlaskConical className="size-3.5 text-ink-tertiary" />
              <span className="text-xs text-ink-tertiary">تست: یک کامنت نمونه بنویسید</span>
            </div>
            <Input dir="rtl" placeholder="مثلاً: سلام قیمت این محصول چنده؟" value={testComment} onChange={(e) => setTestComment(e.target.value)} />
            {testResult && (
              <div className={cn(
                'flex items-center gap-1.5 text-xs',
                testResult.reason === 'match' && 'text-success',
                testResult.reason === 'excluded' && 'text-warning',
                testResult.reason === 'no_match' && 'text-ink-tertiary',
              )}>
                {testResult.reason === 'match' && <><CheckCircle2 className="size-3.5" /> پیام ارسال می‌شود — کلمه «{testResult.hit}» پیدا شد</>}
                {testResult.reason === 'excluded' && <><MinusCircle className="size-3.5" /> نادیده گرفته می‌شود — شامل «{testResult.hit}»</>}
                {testResult.reason === 'no_match' && <><XCircle className="size-3.5" /> پیامی ارسال نمی‌شود — کلیدواژه‌ای پیدا نشد</>}
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>انصراف</Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={keywords.length === 0 || !dmTemplate || createMutation.isPending}
            >
              ذخیره و تست
            </Button>
          </div>
        </div>
      )}

      {/* Rule list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />)}</div>
      ) : (rules ?? []).length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
          <Zap className="size-6 text-ink-tertiary mx-auto" />
          <p className="text-sm text-ink-secondary">
            {readOnly ? 'هنوز اتوماسیونی ساخته نشده' : 'هنوز اتوماسیونی ندارید'}
          </p>
          {readOnly && (
            <p className="text-xs text-ink-tertiary">
              هنگام ساخت یک پست اینستاگرام، در بخش «کامنت به دایرکت» اولین اتوماسیون خود را بسازید.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {(rules ?? []).map((rule) => (
            <div key={rule.id} className={cn('n-card-compact flex items-center gap-3 p-3', !rule.isActive && 'opacity-60')}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {(rule.keywords?.length ? rule.keywords : [rule.keyword]).map((k) => (
                    <span key={k} className="text-sm font-semibold text-ink-primary">«{k}»</span>
                  ))}
                  <span className="text-2xs text-ink-tertiary">→ دایرکت</span>
                  <span className="text-2xs text-ink-tertiary border border-border rounded px-1">{rule.platformName}</span>
                  {rule.publicationId
                    ? <span className="text-2xs text-accent border border-accent/30 rounded px-1 flex items-center gap-0.5"><FileText className="size-2.5" />این پست</span>
                    : <span className="text-2xs text-ink-tertiary border border-border rounded px-1 flex items-center gap-0.5"><Globe className="size-2.5" />همه پست‌ها</span>
                  }
                  {rule.status && rule.status !== 'active' && (
                    <span className="text-2xs text-warning border border-warning/30 rounded px-1">{STATUS_LABELS[rule.status] ?? rule.status}</span>
                  )}
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
