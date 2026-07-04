'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Circle,
  ChevronLeft,
  ChevronRight,
  Send,
  BarChart3,
  Users,
  Loader2,
  Wifi,
  WifiOff,
  ExternalLink,
  PartyPopper,
  UserPlus,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'

// ── Types ─────────────────────────────────────────────────────────────────

interface Platform {
  id: string
  type: string
  status: string
}

interface WorkspaceSnapshot {
  onboardingStep: number
  onboardingCompleted: boolean
  name: string
  timezone: string
  workWeek: string
  platforms: Platform[]
}

interface WizardProps {
  initialStep: number
  workspace: WorkspaceSnapshot | null
}

// ── Step metadata ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome', label: 'خوش‌آمدید' },
  { id: 'workspace', label: 'فضای کار' },
  { id: 'connect', label: 'اتصال کانال' },
  { id: 'verify', label: 'تأیید اتصال' },
  { id: 'first-post', label: 'اولین پست' },
  { id: 'done', label: 'تمام' },
]

const ROLES = [
  { id: 'admin', label: 'مدیر', desc: 'مدیریت تیم، تنظیمات، و استراتژی محتوا' },
  { id: 'editor', label: 'تولیدکننده محتوا', desc: 'نوشتن، زمان‌بندی، و انتشار پست‌ها' },
  { id: 'analyst', label: 'تحلیلگر', desc: 'بررسی آمار و بهینه‌سازی عملکرد' },
]

const OBJECTIVES = [
  { id: 'grow', label: 'رشد مخاطب' },
  { id: 'engage', label: 'تعامل بیشتر' },
  { id: 'brand', label: 'آگاهی از برند' },
  { id: 'sales', label: 'فروش و تبدیل' },
]

const TIMEZONES = [
  { id: 'Asia/Tehran', label: 'تهران (UTC+3:30)' },
  { id: 'Asia/Dubai', label: 'دبی (UTC+4)' },
  { id: 'Europe/Istanbul', label: 'استانبول (UTC+3)' },
  { id: 'UTC', label: 'UTC' },
]

const PLATFORM_LABELS: Record<string, string> = {
  instagram: 'اینستاگرام',
  linkedin: 'لینکدین',
  telegram: 'تلگرام',
  bale: 'بله',
  rubika: 'روبیکا',
}

const PLATFORM_PERMS: Record<string, string[]> = {
  instagram: ['instagram_basic', 'instagram_content_publish', 'pages_show_list'],
  linkedin: ['r_organization_social', 'w_organization_social', 'r_basicprofile'],
  telegram: ['Bot token از BotFather'],
  bale: ['Bot token از پنل بله'],
  rubika: ['API key از پنل روبیکا'],
}

// ── Helpers ───────────────────────────────────────────────────────────────

const _slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -24 },
}

async function saveStep(step: number, extra?: Record<string, unknown>) {
  await api.patch('/api/onboarding', { step, ...extra })
}

// ── Sub-step components ────────────────────────────────────────────────────

function StepWelcome({
  role,
  objective,
  onRole,
  onObjective,
}: {
  role: string
  objective: string
  onRole: (r: string) => void
  onObjective: (o: string) => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-1">به نشرینو خوش آمدید</h2>
        <p className="text-base text-ink-secondary">
          چند سوال کوتاه تا تجربه را برای شما شخصی‌سازی کنیم.
        </p>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-primary mb-3">نقش شما چیست؟</p>
        <div className="space-y-2">
          {ROLES.map((r) => (
            <button
              key={r.id}
              onClick={() => onRole(r.id)}
              className={cn(
                'w-full flex items-start gap-3 rounded-xl border p-4 text-start transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                role === r.id
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-border hover:border-border-strong hover:bg-surface-hover',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                  role === r.id ? 'border-accent bg-accent' : 'border-border',
                )}
              >
                {role === r.id && <span className="size-2 rounded-full bg-white" />}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink-primary">{r.label}</p>
                <p className="text-sm text-ink-tertiary mt-0.5">{r.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-ink-primary mb-3">هدف اصلی شما؟</p>
        <div className="grid grid-cols-2 gap-2">
          {OBJECTIVES.map((o) => (
            <button
              key={o.id}
              onClick={() => onObjective(o.id)}
              className={cn(
                'rounded-xl border px-4 py-3 text-sm font-medium transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                objective === o.id
                  ? 'border-accent bg-accent text-white shadow-sm'
                  : 'border-border text-ink-secondary hover:border-border-strong hover:bg-surface-hover',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StepWorkspace({
  name,
  timezone,
  workWeek,
  onChange,
}: {
  name: string
  timezone: string
  workWeek: string
  onChange: (f: Partial<{ name: string; timezone: string; workWeek: string }>) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-1">فضای کار خود را تنظیم کنید</h2>
        <p className="text-base text-ink-secondary">این اطلاعات در تقویم و گزارش‌ها استفاده می‌شوند.</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ink-primary mb-1.5">
            نام فضای کار
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="مثلاً: برند آرامش"
            dir="rtl"
            className="w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-primary mb-1.5">
            منطقه زمانی
          </label>
          <select
            value={timezone}
            onChange={(e) => onChange({ timezone: e.target.value })}
            className="w-full rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm text-ink-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.id} value={tz.id}>
                {tz.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-ink-primary mb-2">
            هفته کاری
          </label>
          <div className="flex gap-2">
            {(['sat-wed', 'mon-fri'] as const).map((w) => (
              <button
                key={w}
                onClick={() => onChange({ workWeek: w })}
                className={cn(
                  'flex-1 rounded-xl border py-2.5 text-sm font-medium transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
                  workWeek === w
                    ? 'border-accent bg-accent text-white'
                    : 'border-border text-ink-secondary hover:bg-surface-hover',
                )}
              >
                {w === 'sat-wed' ? 'شنبه–چهارشنبه' : 'دوشنبه–جمعه'}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StepConnect({ platforms }: { platforms: Platform[] }) {
  const connected = platforms.filter((p) => p.status === 'connected' || p.status === 'active')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-1">اتصال اولین کانال</h2>
        <p className="text-base text-ink-secondary">
          یک شبکه اجتماعی را به نشرینو وصل کنید تا بتوانید شروع به انتشار کنید.
        </p>
      </div>

      {connected.length > 0 && (
        <div className="rounded-xl border border-success/30 bg-success/8 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <p className="text-sm font-medium text-ink-primary">
            {connected.length} کانال متصل شده — می‌توانید به مرحله بعد بروید.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {['instagram', 'telegram', 'linkedin', 'bale', 'rubika'].map((type) => {
          const isConnected = connected.some((p) => p.type === type)
          return (
            <div key={type} className="n-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold text-ink-primary">
                      {PLATFORM_LABELS[type] ?? type}
                    </p>
                    {isConnected && (
                      <span className="rounded-full bg-success/12 px-2 py-0.5 text-2xs font-semibold text-success">
                        متصل
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(PLATFORM_PERMS[type] ?? []).map((perm) => (
                      <span
                        key={perm}
                        className="rounded-md bg-surface-subtle border border-border px-2 py-0.5 text-2xs text-ink-tertiary font-mono"
                      >
                        {perm}
                      </span>
                    ))}
                  </div>
                </div>
                {!isConnected && (
                  <a
                    href={`/api/platforms/oauth/start?type=${type}&returnTo=/onboarding`}
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-white hover:bg-accent/90 transition-colors shrink-0"
                  >
                    اتصال
                    <ExternalLink className="size-3.5" />
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StepVerify({ platforms }: { platforms: Platform[] }) {
  const healthy = platforms.filter((p) => p.status === 'connected' || p.status === 'active')
  const hasIssues = platforms.filter((p) => p.status === 'error' || p.status === 'expired')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-1">تأیید اتصال‌ها</h2>
        <p className="text-base text-ink-secondary">وضعیت کانال‌های متصل را بررسی کنید.</p>
      </div>

      {platforms.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle p-6 text-center">
          <WifiOff className="size-8 text-ink-tertiary mx-auto mb-2" />
          <p className="text-sm text-ink-tertiary">هنوز کانالی متصل نشده است.</p>
          <p className="text-sm text-ink-tertiary mt-1">به مرحله قبل برگردید و یک کانال متصل کنید.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {platforms.map((p) => {
            const ok = p.status === 'connected' || p.status === 'active'
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised px-4 py-3">
                {ok ? (
                  <Wifi className="size-4.5 text-success shrink-0" />
                ) : (
                  <WifiOff className="size-4.5 text-danger shrink-0" />
                )}
                <span className="text-sm font-medium text-ink-primary flex-1">
                  {PLATFORM_LABELS[p.type] ?? p.type}
                </span>
                <span className={cn('text-xs font-semibold', ok ? 'text-success' : 'text-danger')}>
                  {ok ? 'سالم' : 'خطا'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {hasIssues.length > 0 && (
        <div className="rounded-xl border border-warning/30 bg-warning/8 p-4">
          <p className="text-sm font-medium text-ink-primary mb-1">کانال‌های دارای مشکل</p>
          <p className="text-sm text-ink-secondary">
            به بخش «پلتفرم‌ها و اتصال‌ها» بروید و کانال‌های مشکل‌دار را دوباره متصل کنید.
          </p>
        </div>
      )}

      {healthy.length > 0 && (
        <div className="rounded-xl border border-success/30 bg-success/8 p-4 flex items-center gap-3">
          <CheckCircle2 className="size-5 text-success shrink-0" />
          <p className="text-sm font-medium text-ink-primary">
            {healthy.length} کانال آماده انتشار است.
          </p>
        </div>
      )}
    </div>
  )
}

function StepFirstPost({
  platforms,
  onPublished,
}: {
  platforms: Platform[]
  onPublished: () => void
}) {
  const [caption, setCaption] = useState('')
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(
    platforms[0]?.id ?? null,
  )
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)

  const connected = platforms.filter((p) => p.status === 'connected' || p.status === 'active')

  async function handlePublish() {
    if (!caption.trim() || !selectedPlatform) return
    setPublishing(true)
    try {
      await api.post('/api/publish', {
        platformIds: [selectedPlatform],
        caption,
        scheduleMode: 'now',
      })
      setPublished(true)
      setTimeout(onPublished, 1200)
    } catch {
      // Non-blocking: user can still proceed
    } finally {
      setPublishing(false)
    }
  }

  const TEMPLATES = [
    'سلام! 👋 ما رسماً فعالیت خود را در این شبکه اجتماعی آغاز کردیم. منتظر محتوای جذاب از ما باشید.',
    'امروز یک قدم بزرگ برداشتیم. خوشحالیم که شما هم در این مسیر همراه ما هستید. 🚀',
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-1">اولین پست را منتشر کنید</h2>
        <p className="text-base text-ink-secondary">
          یک پست آزمایشی برای تأیید اتصال و آشنایی با سیستم.
        </p>
      </div>

      {connected.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle p-6 text-center">
          <p className="text-sm text-ink-tertiary">ابتدا یک کانال متصل کنید.</p>
        </div>
      ) : (
        <>
          {/* Platform selector */}
          <div>
            <p className="text-sm font-semibold text-ink-primary mb-2">انتشار در:</p>
            <div className="flex flex-wrap gap-2">
              {connected.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                    selectedPlatform === p.id
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-ink-secondary hover:bg-surface-hover',
                  )}
                >
                  {PLATFORM_LABELS[p.type] ?? p.type}
                </button>
              ))}
            </div>
          </div>

          {/* Template shortcuts */}
          <div>
            <p className="text-sm font-semibold text-ink-primary mb-2">قالب آماده:</p>
            <div className="space-y-2">
              {TEMPLATES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setCaption(t)}
                  className="w-full text-start rounded-xl border border-border px-4 py-3 text-sm text-ink-secondary hover:bg-surface-hover hover:border-border-strong transition-all"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Caption input */}
          <div>
            <label className="block text-sm font-semibold text-ink-primary mb-1.5">
              متن پست
            </label>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={4}
              dir="rtl"
              placeholder="متن پست خود را بنویسید…"
              className="w-full rounded-xl border border-border bg-surface-raised px-4 py-3 text-sm text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-colors resize-none"
            />
            <p className="mt-1 text-xs text-ink-tertiary text-end">{caption.length} کاراکتر</p>
          </div>

          <button
            onClick={handlePublish}
            disabled={!caption.trim() || !selectedPlatform || publishing || published}
            className={cn(
              'w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
              published
                ? 'bg-success text-white'
                : 'bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {publishing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : published ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <Send className="size-4" />
            )}
            {published ? 'منتشر شد!' : publishing ? 'در حال انتشار…' : 'انتشار پست آزمایشی'}
          </button>

          <button
            onClick={onPublished}
            className="w-full text-center text-sm text-ink-tertiary hover:text-ink-secondary transition-colors"
          >
            رد کردن این مرحله
          </button>
        </>
      )}
    </div>
  )
}

function StepDone() {
  return (
    <div className="space-y-8 text-center">
      <div className="flex justify-center">
        <div className="flex size-20 items-center justify-center rounded-full bg-success/12">
          <PartyPopper className="size-10 text-success" />
        </div>
      </div>
      <div>
        <h2 className="text-xl font-bold text-ink-primary mb-2">آماده‌اید! 🎉</h2>
        <p className="text-base text-ink-secondary max-w-sm mx-auto">
          فضای کار شما راه‌اندازی شد. همین الان می‌توانید اولین کمپین را شروع کنید.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-start">
        {[
          { icon: Send, label: 'انتشار محتوا', href: '/compose', desc: 'پست جدید بسازید' },
          { icon: BarChart3, label: 'آمار و گزارش', href: '/analytics', desc: 'عملکرد کانال‌ها' },
          { icon: Users, label: 'دعوت تیم', href: '/settings?tab=team', desc: 'اعضا را اضافه کنید' },
        ].map((item) => {
          const Icon = item.icon
          return (
            <a
              key={item.href}
              href={item.href}
              className="n-card-interactive flex flex-col gap-2 p-4 text-start"
            >
              <Icon className="size-5 text-accent" />
              <p className="text-sm font-semibold text-ink-primary">{item.label}</p>
              <p className="text-xs text-ink-tertiary">{item.desc}</p>
            </a>
          )
        })}
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 flex items-center gap-3 text-start">
        <UserPlus className="size-5 text-accent shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink-primary">تیم خود را دعوت کنید</p>
          <p className="text-xs text-ink-tertiary mt-0.5">
            همکاران را به فضای کار اضافه کنید تا با هم محتوا تولید کنید.
          </p>
        </div>
        <a
          href="/settings?tab=team"
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover transition-colors shrink-0"
        >
          دعوت
        </a>
      </div>
    </div>
  )
}

// ── Main Wizard ────────────────────────────────────────────────────────────

export function OnboardingWizard({ initialStep, workspace }: WizardProps) {
  const router = useRouter()
  const [step, setStep] = useState(initialStep)
  const [saving, setSaving] = useState(false)
  const [direction, setDirection] = useState(1)

  // Form state
  const [role, setRole] = useState('')
  const [objective, setObjective] = useState('')
  const [wsName, setWsName] = useState(workspace?.name ?? '')
  const [timezone, setTimezone] = useState(workspace?.timezone ?? 'Asia/Tehran')
  const [workWeek, setWorkWeek] = useState(workspace?.workWeek ?? 'sat-wed')
  const [platforms] = useState<Platform[]>(workspace?.platforms ?? [])

  const canAdvance = useCallback(() => {
    if (step === 0) return role !== '' && objective !== ''
    if (step === 1) return wsName.trim().length >= 2
    if (step === 2) return platforms.some((p) => p.status === 'connected' || p.status === 'active')
    if (step === 3) return platforms.some((p) => p.status === 'connected' || p.status === 'active')
    return true
  }, [step, role, objective, wsName, platforms])

  async function advance() {
    if (!canAdvance() || saving) return
    setSaving(true)
    setDirection(1)
    try {
      const extra: Record<string, unknown> = {}
      if (step === 1) {
        extra.name = wsName
        extra.timezone = timezone
        extra.workWeek = workWeek
      }
      if (step < STEPS.length - 1) {
        await saveStep(step + 1, extra)
        setStep((s) => s + 1)
      }
      if (step === STEPS.length - 2) {
        await api.patch('/api/onboarding', { completed: true })
      }
    } finally {
      setSaving(false)
    }
  }

  async function back() {
    if (step === 0 || saving) return
    setDirection(-1)
    await saveStep(step - 1)
    setStep((s) => s - 1)
  }

  function handleDone() {
    router.push('/')
  }

  const isDone = step === STEPS.length - 1

  return (
    <div dir="rtl" className="h-dvh overflow-y-auto thin-scrollbar flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border/40 px-6 py-4 shrink-0">
        <div className="flex size-7 items-center justify-center rounded-md bg-accent">
          <span className="text-sm font-bold text-white leading-none">N</span>
        </div>
        <span className="text-base font-bold text-ink-primary">نشرینو</span>
        <span className="ms-auto text-sm text-ink-tertiary">
          {step + 1} از {STEPS.length}
        </span>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-border shrink-0">
        <motion.div
          className="h-full bg-accent"
          animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        />
      </div>

      {/* Step pills */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar px-6 py-3 shrink-0 border-b border-border/40">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1 shrink-0">
            <div className="flex items-center gap-1.5">
              {i < step ? (
                <CheckCircle2 className="size-4 text-accent" />
              ) : i === step ? (
                <div className="size-4 rounded-full border-2 border-accent bg-accent/20 flex items-center justify-center">
                  <div className="size-1.5 rounded-full bg-accent" />
                </div>
              ) : (
                <Circle className="size-4 text-ink-tertiary/40" />
              )}
              <span
                className={cn(
                  'text-2xs font-medium',
                  i === step ? 'text-accent' : i < step ? 'text-ink-secondary' : 'text-ink-tertiary/50',
                )}
              >
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn('w-5 h-px shrink-0', i < step ? 'bg-accent/40' : 'bg-border')} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-xl px-6 py-8">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: direction * 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -30 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            >
              {step === 0 && (
                <StepWelcome
                  role={role}
                  objective={objective}
                  onRole={setRole}
                  onObjective={setObjective}
                />
              )}
              {step === 1 && (
                <StepWorkspace
                  name={wsName}
                  timezone={timezone}
                  workWeek={workWeek}
                  onChange={(f) => {
                    if (f.name !== undefined) setWsName(f.name)
                    if (f.timezone !== undefined) setTimezone(f.timezone)
                    if (f.workWeek !== undefined) setWorkWeek(f.workWeek)
                  }}
                />
              )}
              {step === 2 && <StepConnect platforms={platforms} />}
              {step === 3 && <StepVerify platforms={platforms} />}
              {step === 4 && (
                <StepFirstPost platforms={platforms} onPublished={() => { setDirection(1); setStep(5) }} />
              )}
              {step === 5 && <StepDone />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer nav */}
      <footer className="border-t border-border/40 px-6 py-4 flex items-center gap-3 shrink-0">
        {step > 0 && !isDone && (
          <button
            onClick={back}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-ink-secondary hover:bg-surface-hover transition-colors disabled:opacity-50 min-h-[44px]"
          >
            <ChevronRight className="size-4" />
            قبلی
          </button>
        )}

        {!isDone && (
          <button
            onClick={advance}
            disabled={!canAdvance() || saving}
            className={cn(
              'ms-auto flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all min-h-[44px]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
              canAdvance() && !saving
                ? 'bg-accent text-white hover:bg-accent/90'
                : 'bg-surface-subtle text-ink-tertiary cursor-not-allowed',
            )}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                {step === STEPS.length - 2 ? 'اتمام' : 'بعدی'}
                <ChevronLeft className="size-4" />
              </>
            )}
          </button>
        )}

        {isDone && (
          <button
            onClick={handleDone}
            className="ms-auto flex items-center gap-2 rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition-colors min-h-[44px]"
          >
            رفتن به داشبورد
            <ChevronLeft className="size-4" />
          </button>
        )}
      </footer>
    </div>
  )
}
