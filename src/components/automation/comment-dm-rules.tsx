'use client'

import { useMemo, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Zap, Plus, Trash2, ToggleLeft, ToggleRight, Globe, FileText, ChevronUp,
  Sparkles, FlaskConical, CheckCircle2, XCircle, MinusCircle, Pencil, X,
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

interface DmPreset {
  id: string
  label: string
  keyword: string
  dmTemplate: string
  publicReply: string
  buttonText: string
}

const DM_PRESETS: DmPreset[] = [
  { id: 'price', label: 'لیست قیمت', keyword: 'قیمت', dmTemplate: 'سلام {نام} عزیز 🌿\nلیست قیمت و جزئیات این محصول اینجاست:\n{لینک}', publicReply: 'دایرکت شد ✉️', buttonText: 'دیدن قیمت' },
  { id: 'catalog', label: 'کاتالوگ', keyword: 'کاتالوگ', dmTemplate: 'سلام {نام} عزیز 👋\nکاتالوگ کامل محصولات را از این لینک ببینید:\n{لینک}', publicReply: 'کاتالوگ را دایرکت کردیم ✉️', buttonText: 'دریافت کاتالوگ' },
  { id: 'discount', label: 'کد تخفیف', keyword: 'تخفیف', dmTemplate: 'سلام {نام} عزیز 🎁\nکد تخفیف اختصاصی شما: NASHRINO10', publicReply: 'کد تخفیف دایرکت شد 🎁', buttonText: 'استفاده از تخفیف' },
  { id: 'booking', label: 'لینک رزرو', keyword: 'رزرو', dmTemplate: 'سلام {نام} عزیز 🗓\nبرای رزرو نوبت از این لینک استفاده کنید:\n{لینک}', publicReply: 'لینک رزرو را دایرکت کردیم ✉️', buttonText: 'رزرو وقت' },
  { id: 'signup', label: 'ثبت‌نام', keyword: 'ثبت‌نام', dmTemplate: 'سلام {نام} عزیز ✨\nبرای ثبت‌نام در دوره از این لینک اقدام کنید:\n{لینک}', publicReply: 'لینک ثبت‌نام دایرکت شد ✉️', buttonText: 'ثبت‌نام' },
]

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
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [platformId, setPlatformId] = useState(igPlatforms[0]?.id ?? '')
  const [keywordsRaw, setKeywordsRaw] = useState(suggestedKeyword ?? '')
  const [dmTemplate, setDmTemplate] = useState('')
  const [excludeRaw, setExcludeRaw] = useState('')
  const [publicReply, setPublicReply] = useState('')
  const [buttonText, setButtonText] = useState('')
  const [buttonUrl, setButtonUrl] = useState('')
  const [optOutKeyword, setOptOutKeyword] = useState('نه')
  const [freqCapHours, setFreqCapHours] = useState<number>(24)
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

  const hasDirtyForm = Boolean(
    keywordsRaw.trim() || dmTemplate.trim() || buttonText.trim() || buttonUrl.trim() || excludeRaw.trim()
  )

  const resetForm = () => {
    setEditingRuleId(null)
    setKeywordsRaw(suggestedKeyword ?? '')
    setDmTemplate('')
    setExcludeRaw('')
    setPublicReply('')
    setButtonText('')
    setButtonUrl('')
    setOptOutKeyword('نه')
    setFreqCapHours(24)
    setTestComment('')
    setShowAdvanced(false)
  }

  const closeBuilder = () => {
    if (hasDirtyForm && !window.confirm('تغییرات ذخیره‌نشده حذف شود؟')) return
    setShowForm(false)
    resetForm()
  }

  /** Enter edit mode: populate the form from an existing rule. */
  const startEdit = (rule: CommentDmRule) => {
    setEditingRuleId(rule.id)
    setPlatformId(rule.platformId)
    setKeywordsRaw(rule.keywords?.length ? rule.keywords.join('، ') : rule.keyword)
    setDmTemplate(rule.dmTemplate)
    setExcludeRaw(rule.excludeKeywords?.length ? rule.excludeKeywords.join('، ') : '')
    setPublicReply(rule.publicReply ?? '')
    setButtonText(rule.buttonText ?? '')
    setButtonUrl(rule.buttonUrl ?? '')
    setOptOutKeyword(rule.optOutKeyword || 'نه')
    setFreqCapHours(rule.freqCapHours ?? 24)
    setTestComment('')
    setShowForm(true)
    setShowAdvanced(true)
    // Scroll the form into view
    requestAnimationFrame(() => {
      document.getElementById('comment-dm-builder')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const applyPreset = (preset: DmPreset) => {
    setKeywordsRaw(preset.keyword)
    setDmTemplate(preset.dmTemplate)
    setPublicReply(preset.publicReply)
    setButtonText(preset.buttonText)
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
      freqCapHours,
      publicationId: publicationId ?? null,
    }),
    onSuccess: () => {
      toast.success('دایرکت خودکار فعال شد')
      queryClient.invalidateQueries({ queryKey })
      setShowForm(false)
      resetForm()
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'مشکلی پیش آمد'),
  })

  const updateMutation = useMutation({
    mutationFn: () => api.patch(`/api/automation/comment-dm-rules/${editingRuleId}`, {
      platformId,
      keywords,
      excludeKeywords,
      dmTemplate,
      buttonText: buttonText || null,
      buttonUrl: buttonUrl || null,
      publicReply: publicReply || null,
      optOutKeyword,
      freqCapHours,
    }),
    onSuccess: () => {
      toast.success('تغییرات ذخیره شد')
      queryClient.invalidateQueries({ queryKey })
      setShowForm(false)
      resetForm()
    },
    onError: (err: unknown) => toast.error((err as Error).message || 'مشکلی پیش آمد'),
  })

  const isEditing = editingRuleId != null
  const saveMutation = isEditing ? updateMutation : createMutation

  const handleSave = () => {
    if (isEditing) updateMutation.mutate()
    else createMutation.mutate()
  }

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.patch(`/api/automation/comment-dm-rules/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
    onError: () => toast.error('خطا در تغییر وضعیت'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/api/automation/comment-dm-rules/${id}`),
    onSuccess: () => {
      toast.success('دایرکت خودکار حذف شد')
      queryClient.invalidateQueries({ queryKey })
    },
    onError: () => toast.error('خطا در حذف'),
  })

  // Feature not enabled → 403 from API
  if (error && (error as Error).message?.includes('بتا')) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">دایرکت خودکار از کامنت در مرحله بتا است و برای این فضای کار فعال نشده.</p>
      </div>
    )
  }

  if (igPlatforms.length === 0 && !readOnly) {
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
        <Zap className="size-6 text-ink-tertiary mx-auto" />
        <p className="text-sm text-ink-secondary">برای ساخت دایرکت خودکار ابتدا یک حساب اینستاگرام متصل کنید.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-primary flex items-center gap-2">
            <Zap className="size-4 text-accent" />
            دایرکت خودکار از کامنت
            {!readOnly && (isPerPost
              ? <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><FileText className="size-3" /> این پست</span>
              : <span className="text-2xs font-normal text-ink-tertiary flex items-center gap-1"><Globe className="size-3" /> همه پست‌ها</span>
            )}
          </h3>
          <p className="text-sm text-ink-secondary">
            {readOnly
              ? 'دایرکت‌های خودکار ساخته‌شده — برای ساخت مورد جدید هنگام ساخت پست اقدام کنید'
              : 'اگر مخاطب زیر پست شما کلمه‌ای مثل «قیمت» بنویسد، پیام آماده را در دایرکت دریافت می‌کند.'}
          </p>
        </div>
        {!readOnly && (showForm
          ? (
            <button
              type="button"
              onClick={closeBuilder}
              aria-label="بستن"
              className="n-focus-ring shrink-0 text-ink-tertiary hover:text-ink-primary min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronUp className="size-4" />
            </button>
          )
          : (
            <Button size="sm" onClick={() => setShowForm(true)} className="shrink-0">
              <Plus className="size-4" />
              ساخت دایرکت خودکار
            </Button>
          )
        )}
      </div>

      {/* Create/Edit form — two fields by default, everything else under Advanced */}
      {!readOnly && showForm && (
        <div id="comment-dm-builder" className="n-card p-4 space-y-4">
          {/* Presets */}
          <div className="space-y-2">
            <p className="text-xs text-ink-tertiary">برای چه چیزی دایرکت می‌فرستید؟</p>
            <div className="flex flex-wrap gap-2">
              {DM_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="n-focus-ring inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-3 py-1.5 text-xs text-ink-secondary hover:border-accent hover:text-accent"
                >
                  <Sparkles className="size-3" />
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Account selector — only when the workspace has more than one IG account */}
          {igPlatforms.length > 1 && (
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
          )}

          {/* Primary field 1 — keyword */}
          <div className="space-y-1.5">
            <Label>۱. کلمه‌ای که مخاطب کامنت می‌کند</Label>
            <Input
              dir="rtl"
              placeholder="مثال: قیمت"
              value={keywordsRaw}
              onChange={(e) => setKeywordsRaw(e.target.value)}
            />
            {keywords.length > 1 && (
              <p className="text-xs text-ink-tertiary">هر کدام از این کلمه‌ها دیده شد، پیام ارسال می‌شود</p>
            )}
          </div>

          {/* Primary field 2 — DM message */}
          <div className="space-y-1.5">
            <Label>۲. پیامی که برای مخاطب می‌رود</Label>
            <Textarea
              dir="rtl"
              rows={3}
              placeholder={'سلام {نام} عزیز، لینک و جزئیات این محصول اینجاست: {لینک}'}
              value={dmTemplate}
              onChange={(e) => setDmTemplate(e.target.value)}
            />
            <p className="text-xs text-ink-tertiary">متغیر: &#x7B;نام&#x7D; با نام کاربر جایگزین می‌شود</p>
          </div>

          {/* Instagram-style preview */}
          {dmTemplate && (
            <div className="rounded-2xl border border-border bg-background p-3">
              <div className="mb-2 text-2xs text-ink-tertiary">مخاطب این پیام را می‌بیند</div>
              <div className="max-w-[85%] rounded-2xl rounded-ee-sm bg-accent text-white px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                {previewTemplate(dmTemplate, previewName || 'آرش')}
              </div>
              {buttonText && (
                <div className="mt-2 inline-flex rounded-full border border-accent/30 px-3 py-1 text-xs text-accent">
                  {buttonText}
                </div>
              )}
            </div>
          )}

          {/* Primary CTA */}
          <div className="flex justify-end gap-2">
            {isEditing && (
              <Button variant="ghost" onClick={resetForm} disabled={saveMutation.isPending}>
                <X className="size-4" />
                انصراف
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={keywords.length === 0 || !dmTemplate || saveMutation.isPending}
            >
              {isEditing ? 'ذخیره تغییرات' : 'فعال‌سازی دایرکت خودکار'}
            </Button>
          </div>

          {/* Advanced settings toggle */}
          <div className="border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="n-focus-ring text-xs font-semibold text-accent hover:underline"
            >
              {showAdvanced ? 'بستن تنظیمات پیشرفته' : 'تنظیمات پیشرفته'}
            </button>
          </div>

          {showAdvanced && (
            <div className="rounded-xl border border-border bg-surface-subtle p-3 space-y-3">
              <div className="space-y-1.5">
                <Label>پاسخ کوتاه زیر کامنت</Label>
                <Input dir="rtl" placeholder="مثال: دایرکت شد ✉️" value={publicReply} onChange={(e) => setPublicReply(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>دکمه داخل دایرکت</Label>
                  <Input dir="rtl" placeholder="مثال: دریافت لینک 🔗" value={buttonText} onChange={(e) => setButtonText(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>لینک دکمه</Label>
                  <Input dir="ltr" placeholder="https://…" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>اگر این کلمه‌ها بود، پیام نده</Label>
                <Input dir="rtl" placeholder="مثال: گران، شکایت" value={excludeRaw} onChange={(e) => setExcludeRaw(e.target.value)} />
                <p className="text-xs text-ink-tertiary">با ویرگول یا خط فاصله جدا کنید</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>کلمه انصراف</Label>
                  <Input dir="rtl" value={optOutKeyword} onChange={(e) => setOptOutKeyword(e.target.value)} />
                  <p className="text-xs text-ink-tertiary">اگر مخاطب این کلمه را بنویسد، پیامی نمی‌رود</p>
                </div>
                <div className="space-y-1.5">
                  <Label>حداقل فاصله بین پیام‌ها (ساعت)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    dir="ltr"
                    className="text-right"
                    value={freqCapHours}
                    onChange={(e) => {
                      const v = Number(e.target.value)
                      setFreqCapHours(Number.isFinite(v) && v >= 0 ? v : 24)
                    }}
                  />
                  <p className="text-xs text-ink-tertiary">جلوگیری از ارسال مکرر به یک کاربر</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>نام نمونه برای پیش‌نمایش</Label>
                <Input dir="rtl" className="max-w-[160px]" value={previewName} onChange={(e) => setPreviewName(e.target.value)} placeholder="نام" />
              </div>

              {/* Test runner */}
              <div className="rounded-lg border border-border bg-background p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <FlaskConical className="size-3.5 text-ink-tertiary" />
                  <span className="text-xs text-ink-tertiary">تست با کامنت نمونه</span>
                </div>
                <Input dir="rtl" placeholder="مثلاً: سلام قیمت چنده؟" value={testComment} onChange={(e) => setTestComment(e.target.value)} />
                {testResult && (
                  <div className={cn(
                    'flex items-center gap-1.5 text-xs',
                    testResult.reason === 'match' && 'text-success',
                    testResult.reason === 'excluded' && 'text-warning',
                    testResult.reason === 'no_match' && 'text-ink-tertiary',
                  )}>
                    {testResult.reason === 'match' && <><CheckCircle2 className="size-3.5" /> پیام ارسال می‌شود — کلمه «{testResult.hit}» پیدا شد</>}
                    {testResult.reason === 'excluded' && <><MinusCircle className="size-3.5" /> پیام ارسال نمی‌شود — شامل «{testResult.hit}»</>}
                    {testResult.reason === 'no_match' && <><XCircle className="size-3.5" /> پیامی ارسال نمی‌شود — کلمه‌ای پیدا نشد</>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Short compliance note */}
          <p className="text-2xs text-ink-tertiary leading-relaxed">
            نکته اینستاگرام: برای هر کامنت فقط یک دایرکت خودکار می‌توان فرستاد. اگر مخاطب پاسخ بدهد، گفت‌وگو ادامه پیدا می‌کند.
          </p>
        </div>
      )}

      {/* Rule list */}
      {isLoading ? (
        <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-surface-hover animate-pulse" />)}</div>
      ) : (rules ?? []).length === 0 && !showForm ? (
        <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2">
          <Zap className="size-6 text-ink-tertiary mx-auto" />
          <p className="text-sm text-ink-secondary">هنوز دایرکت خودکاری ساخته نشده</p>
          {readOnly && (
            <p className="text-xs text-ink-tertiary">
              هنگام ساخت پست اینستاگرام می‌توانید مشخص کنید اگر کسی کلمه‌ای مثل «قیمت» یا «کاتالوگ» را کامنت کرد، چه پیامی برایش ارسال شود.
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
                onClick={() => startEdit(rule)}
                className="n-focus-ring shrink-0 text-ink-tertiary hover:text-accent min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label="ویرایش"
              >
                <Pencil className="size-4" />
              </button>
              <button
                onClick={() => { if (window.confirm('این دایرکت خودکار حذف شود؟')) deleteMutation.mutate(rule.id) }}
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
