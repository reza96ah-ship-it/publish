'use client'

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import { useTheme } from 'next-themes'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { pageTransition, pageTransitionProps } from '@/lib/motion'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon,
  Building2,
  Palette,
  Users,
  CreditCard,
  Bell,
  Plus,
  Hash,
  Check,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  HelpCircle,
  Download,
  ExternalLink,
  Link2,
  Zap,
  FlaskConical,
  Receipt,
  Key,
  Webhook,
} from 'lucide-react'

import { api } from '@/lib/api'
import { CommentDmRulesPanel } from '@/components/automation/comment-dm-rules'
import { FeatureFlagsPanel } from '@/components/settings/feature-flags-panel'
import { ApiTokensPanel } from '@/components/settings/api-tokens-panel'
import { WebhooksPanel } from '@/components/settings/webhooks-panel'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  Skeleton,
  LoadingState,
  ErrorState,
  AnimatedTabs,
  EmptyState,
} from '@/components/dashboard/shared'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface Workspace {
  id: string
  name: string
  slug: string
  category: string
  phone: string
  description: string
  timezone: string
  plan: string
  brandPrimaryColor: string
  brandAccentColor: string
  brandVoice: string
  defaultCta: string
  contentGuidelines: string
  defaultHashtags: string
  captionFooter: string
  // Issue #213: comma-separated Persian phrases that must never appear in
  // AI-generated captions or published content.
  bannedWords: string
  persianDigits: boolean
}

interface Member {
  id: string
  name: string
  email: string
  role: string
  roleLabel: string
  avatar: string | null
}

/** Per-user notification preferences — shape returned by /api/notifications/preferences. */
type NotificationPrefs = Record<string, { email: boolean; push: boolean; inApp: boolean }>

const NOTIFICATION_TOGGLES = [
  {
    id: 'publish_success',
    label: 'موفقیت انتشار',
    desc: 'هنگام انتشار موفق پست',
    icon: Check,
    defaultOn: true,
  },
  {
    id: 'publish_failed',
    label: 'شکست انتشار',
    desc: 'هنگام ناموفق بودن انتشار',
    icon: Bell,
    defaultOn: true,
  },
  {
    id: 'approval_requested',
    label: 'درخواست تأیید',
    desc: 'هنگام نیاز به تأیید محتوا',
    icon: Users,
    defaultOn: true,
  },
  {
    id: 'inbox_new',
    label: 'پیام جدید',
    desc: 'هنگام دریافت کامنت یا پیام مستقیم',
    icon: Bell,
    defaultOn: false,
  },
  {
    id: 'token_expiring',
    label: 'انقضای توکن',
    desc: 'هشدار قبل از انقضای توکن پلتفرم',
    icon: Bell,
    defaultOn: true,
  },
  {
    id: 'channel_disconnected',
    label: 'قطع اتصال کانال',
    desc: 'هنگام قطع شدن پلتفرم',
    icon: Bell,
    defaultOn: true,
  },
] as const

/** Channels surfaced per category in the Notifications tab. Each row has an
 *  in-app toggle (always shown) plus optional email + push toggles. */
const NOTIFICATION_CHANNELS: { key: 'inApp' | 'email' | 'push'; label: string }[] = [
  { key: 'inApp', label: 'داخل برنامه' },
  { key: 'email', label: 'ایمیل' },
  { key: 'push', label: 'اعلان سیستمی' },
]

export function SettingsView() {
  const [tab, setTab] = useState<
    | 'overview'
    | 'brand'
    | 'team'
    | 'billing'
    | 'notifications'
    | 'utm'
    | 'automation'
    | 'labs'
    | 'api'
    | 'webhooks'
  >('overview')

  const { data: platforms = [] } = useQuery<{ id: string; name: string; type: string }[]>({
    queryKey: ['platforms'],
    queryFn: () => api.getPaginated('/api/platforms'),
    staleTime: 60_000,
  })

  return (
    <motion.div
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      transition={pageTransitionProps}
      className="space-y-5"
    >
      <SectionTitle icon={SettingsIcon}>تنظیمات فضای کار</SectionTitle>

      <div className="w-full overflow-x-auto thin-scrollbar no-scrollbar">
        <AnimatedTabs
          value={tab}
          onValueChange={(v) => setTab(v as typeof tab)}
          tabs={[
            { value: 'overview', label: 'نمای کلی', icon: Building2 },
            { value: 'brand', label: 'برند', icon: Palette },
            { value: 'team', label: 'تیم', icon: Users },
            { value: 'billing', label: 'صورت‌گیری', icon: CreditCard },
            { value: 'notifications', label: 'اعلان‌ها', icon: Bell },
            { value: 'utm', label: 'ردیابی UTM', icon: Link2 },
            { value: 'automation', label: 'اتوماسیون', icon: Zap },
            { value: 'labs', label: 'قابلیت‌های بتا', icon: FlaskConical },
            { value: 'api', label: 'API', icon: Key },
            { value: 'webhooks', label: 'وب‌هوک', icon: Webhook },
          ]}
        />
      </div>

      <Tabs value={tab} className="w-full">
        <TabsContent value="overview" className="mt-4">
          <OverviewTab key="overview" />
        </TabsContent>
        <TabsContent value="brand" className="mt-4">
          <BrandTab key="brand" />
        </TabsContent>
        <TabsContent value="team" className="mt-4">
          <TeamTab />
        </TabsContent>
        <TabsContent value="billing" className="mt-4">
          <BillingTab />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab />
        </TabsContent>
        <TabsContent value="utm" className="mt-4">
          <UtmSection />
        </TabsContent>
        <TabsContent value="automation" className="mt-4">
          <CommentDmRulesPanel platforms={platforms} readOnly />
        </TabsContent>
        <TabsContent value="labs" className="mt-4">
          <FeatureFlagsPanel />
        </TabsContent>
        <TabsContent value="api" className="mt-4">
          <ApiTokensPanel />
        </TabsContent>
        <TabsContent value="webhooks" className="mt-4">
          <WebhooksPanel />
        </TabsContent>
      </Tabs>
    </motion.div>
  )
}

/* ── Appearance ── */
const THEME_OPTIONS = [
  { value: 'light', label: 'روشن', icon: Sun },
  { value: 'dark', label: 'تاریک', icon: Moon },
  { value: 'system', label: 'سیستم', icon: Monitor },
] as const

type Density = 'comfortable' | 'compact'

function useDensity(): [Density, (d: Density) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const handler = (e: StorageEvent) => {
      if (e.key === 'nashrino-density') onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  const density = useSyncExternalStore(
    subscribe,
    () => (localStorage.getItem('nashrino-density') ?? 'comfortable') as Density,
    () => 'comfortable' as Density,
  )

  // Sync density value to DOM attribute (external system — not a setState call)
  useEffect(() => {
    if (density === 'compact') {
      document.documentElement.setAttribute('data-density', 'compact')
    } else {
      document.documentElement.removeAttribute('data-density')
    }
  }, [density])

  const setDensity = useCallback((d: Density) => {
    localStorage.setItem('nashrino-density', d)
    window.dispatchEvent(new StorageEvent('storage', { key: 'nashrino-density', newValue: d }))
  }, [])

  return [density, setDensity]
}

function AppearanceSection() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false)
  const [density, setDensity] = useDensity()

  return (
    <div className="n-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sun className="size-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-primary">ظاهر</h2>
      </div>
      <p className="text-sm text-ink-tertiary mb-4">
        پوسته برنامه را انتخاب کنید. «سیستم» به تنظیم سیستم‌عامل پیروی می‌کند.
      </p>
      <div className="flex gap-3 mb-6">
        {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
          const active = mounted && theme === value
          return (
            <button
              key={value}
              onClick={() => setTheme(value)}
              aria-pressed={active}
              className={`n-focus-ring flex flex-1 flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors ${
                active
                  ? 'border-accent bg-accent-soft text-accent'
                  : 'border-border bg-surface text-ink-secondary hover:border-border-strong hover:bg-surface-hover'
              }`}
            >
              <Icon className="size-5" strokeWidth={1.75} />
              {label}
            </button>
          )
        })}
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium text-ink-primary">تراکم نمایش</p>
        <p className="text-xs text-ink-secondary">حالت فشرده برای داشبوردهای عملیاتی مناسب است</p>
        <div className="flex gap-2">
          <button
            onClick={() => setDensity('comfortable')}
            className={cn(
              'flex-1 rounded-lg border p-3 text-sm transition-colors n-focus-ring',
              density === 'comfortable'
                ? 'border-accent bg-accent/5 text-accent font-medium'
                : 'border-border text-ink-secondary hover:border-accent/50'
            )}
          >
            عادی
          </button>
          <button
            onClick={() => setDensity('compact')}
            className={cn(
              'flex-1 rounded-lg border p-3 text-sm transition-colors n-focus-ring',
              density === 'compact'
                ? 'border-accent bg-accent/5 text-accent font-medium'
                : 'border-border text-ink-secondary hover:border-accent/50'
            )}
          >
            فشرده
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Overview ── */
function OverviewTab() {
  const { data: ws, isLoading, isError, refetch } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
  })
  if (isError) {
    return <ErrorState label="خطا در بارگذاری تنظیمات" onRetry={refetch} />
  }
  // Mount the inner form once we have data, so useState initializer picks it up.
  if (isLoading || !ws) {
    return (
      <div className="n-card n-gradient-border p-5 max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">پروفایل فضای کار</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      <OverviewForm ws={ws} />
      <AppearanceSection />
      <SupportCard />
    </div>
  )
}

function SupportCard() {
  const [downloading, setDownloading] = useState(false)

  async function downloadBundle() {
    setDownloading(true)
    try {
      const res = await fetch('/api/support-bundle')
      if (!res.ok) throw new Error('failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `nashrino-support-bundle-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('بسته پشتیبانی دانلود شد.')
    } catch {
      toast.error('دانلود بسته پشتیبانی ناموفق بود.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="n-card p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <HelpCircle className="size-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-primary">پشتیبانی و تشخیص</h2>
      </div>
      <div className="space-y-3">
        <p className="text-sm text-ink-secondary">
          برای گزارش مشکل به تیم پشتیبانی، می‌توانید یک «بسته پشتیبانی» دانلود کنید. این فایل
          شامل اطلاعات تشخیصی بدون اطلاعات شخصی یا توکن‌های دسترسی است.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={downloadBundle}
            disabled={downloading}
            className="n-focus-ring"
          >
            {downloading ? (
              <>در حال آماده‌سازی…</>
            ) : (
              <>
                <Download className="size-4" />
                دانلود بسته پشتیبانی
              </>
            )}
          </Button>
          <Button variant="outline" size="sm" asChild className="n-focus-ring">
            <a href="mailto:support@nashrino.com" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" />
              تماس با پشتیبانی
            </a>
          </Button>
        </div>
        <p className="text-xs text-ink-tertiary">
          <a href="/help" className="underline underline-offset-2 hover:text-ink-secondary transition-colors">
            مرکز راهنما
          </a>{' '}
          — پاسخ سوالات رایج و راهنمای اتصال کانال‌ها
        </p>
      </div>
    </div>
  )
}

function OverviewForm({ ws }: { ws: Workspace }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Workspace>>(ws)
  const set = (key: keyof Workspace, value: string) => setForm((cur) => ({ ...cur, [key]: value }))

  // Issue #213 / settings-brandkit: real PATCH /api/workspace mutation.
  // Replaces the previous disabled button + "به‌زودی" badge.
  const saveMutation = useMutation({
    mutationFn: (body: Partial<Workspace>) => api.patch<Workspace>('/api/workspace', body),
    onSuccess: (updated) => {
      qc.setQueryData(['workspace'], updated)
      toast.success('تنظیمات پروفایل ذخیره شد.')
      announce('تنظیمات ذخیره شد')
    },
    onError: (err: unknown) => {
      let msg = 'ذخیره تنظیمات ناموفق بود'
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          if (typeof parsed?.error === 'string') msg = parsed.error
        } catch {
          msg = err.message
        }
      }
      toast.error(msg)
    },
  })

  return (
    <div className="n-card n-gradient-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="size-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-primary">پروفایل فضای کار</h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">نام فضای کار</Label>
            <Input
              dir="rtl"
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">دسته‌بندی</Label>
            <Input
              dir="rtl"
              value={form.category ?? ''}
              onChange={(e) => set('category', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">تلفن</Label>
            <Input
              dir="ltr"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              className="text-left"
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">منطقه زمانی</Label>
            <Select
              value={form.timezone ?? 'Asia/Tehran'}
              onValueChange={(v) => set('timezone', v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Asia/Tehran">Asia/Tehran (ایران)</SelectItem>
                <SelectItem value="Asia/Dubai">Asia/Dubai (امارات)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-sm text-ink-secondary mb-1.5 block">توضیحات</Label>
          <Textarea
            dir="rtl"
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            className="resize-none"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => saveMutation.mutate(form)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره تغییرات'}
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ── Brand ── */
function BrandTab() {
  const { data: ws, isLoading, isError, refetch } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
  })
  if (isError) {
    return <ErrorState label="خطا در بارگذاری تنظیمات برند" onRetry={refetch} />
  }
  if (isLoading || !ws) {
    return (
      <div className="n-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">کیت برند</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }
  return <BrandForm ws={ws} />
}

function BrandForm({ ws }: { ws: Workspace }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Workspace>>(ws)
  const set = (key: keyof Workspace, value: string | boolean) =>
    setForm((cur) => ({ ...cur, [key]: value }))

  // Issue #213 / settings-brandkit: real PATCH /api/workspace mutation.
  // Replaces the previous disabled button + "به‌زودی" badge.
  const saveMutation = useMutation({
    mutationFn: (body: Partial<Workspace>) => api.patch<Workspace>('/api/workspace', body),
    onSuccess: (updated) => {
      qc.setQueryData(['workspace'], updated)
      toast.success('کیت برند ذخیره شد.')
      announce('کیت برند ذخیره شد')
    },
    onError: (err: unknown) => {
      let msg = 'ذخیره کیت برند ناموفق بود'
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          if (typeof parsed?.error === 'string') msg = parsed.error
        } catch {
          msg = err.message
        }
      }
      toast.error(msg)
    },
  })

  // Apply brand colors to CSS variables live — per AUDIT-1B QW6.
  // brandAccentColor → --n-accent (the app's primary accent token).
  // brandPrimaryColor is used for brand-specific surfaces (logo bg, etc.)
  useEffect(() => {
    if (form.brandAccentColor) {
      document.documentElement.style.setProperty('--brand-accent', form.brandAccentColor)
    }
    if (form.brandPrimaryColor) {
      document.documentElement.style.setProperty('--brand-primary', form.brandPrimaryColor)
    }
  }, [form.brandAccentColor, form.brandPrimaryColor])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 n-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">کیت برند</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">رنگ اصلی</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandPrimaryColor ?? '#0F766E'}
                  onChange={(e) => set('brandPrimaryColor', e.target.value)}
                  className="size-9 rounded-md border border-border cursor-pointer bg-transparent"
                />
                <Input
                  dir="ltr"
                  value={form.brandPrimaryColor ?? ''}
                  onChange={(e) => set('brandPrimaryColor', e.target.value)}
                  className="text-left flex-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">رنگ تأکید</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.brandAccentColor ?? '#7c3aed'}
                  onChange={(e) => set('brandAccentColor', e.target.value)}
                  className="size-9 rounded-md border border-border cursor-pointer bg-transparent"
                />
                <Input
                  dir="ltr"
                  value={form.brandAccentColor ?? ''}
                  onChange={(e) => set('brandAccentColor', e.target.value)}
                  className="text-left flex-1"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">لحن برند</Label>
            <Textarea
              dir="rtl"
              rows={2}
              placeholder="مثال: صمیمی، حرفه‌ای، کمی طنز"
              value={form.brandVoice ?? ''}
              onChange={(e) => set('brandVoice', e.target.value)}
              className="resize-none"
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">CTA پیش‌فرض</Label>
            <Input
              dir="rtl"
              placeholder="مثال: همین حالا سفارش دهید"
              value={form.defaultCta ?? ''}
              onChange={(e) => set('defaultCta', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">
              دستورالعمل‌های محتوایی
            </Label>
            <Textarea
              dir="rtl"
              rows={3}
              placeholder="قوانین نگارش، کلمات ممنوعه، سبک و…"
              value={form.contentGuidelines ?? ''}
              onChange={(e) => set('contentGuidelines', e.target.value)}
              className="resize-none"
            />
          </div>
          {/* Issue #213: banned words list — injected into the AI caption prompt
              as a hard "do not use" list AND checked client-side before publish. */}
          <div>
            <Label className="text-sm text-ink-secondary mb-1.5 block">
              <span className="inline-flex items-center gap-1">
                <Hash className="size-3.5" /> کلمات ممنوعه
              </span>
            </Label>
            <Textarea
              dir="rtl"
              rows={2}
              placeholder="کلمات یا عبارت‌های ممنوعه، با کاما جدا کنید — مثال: تخفیف ویژه, ارزان‌ترین"
              value={form.bannedWords ?? ''}
              onChange={(e) => set('bannedWords', e.target.value)}
              className="resize-none"
            />
            <p className="text-2xs text-ink-tertiary mt-1">
              این کلمات به پرامپت هوش مصنوعی تزریق می‌شوند و پیش از انتشار، در کپشن بررسی می‌شوند.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">
                <span className="inline-flex items-center gap-1">
                  <Hash className="size-3.5" /> هشتگ‌های پیش‌فرض
                </span>
              </Label>
              <Input
                dir="rtl"
                placeholder="#برند_من #محصول"
                value={form.defaultHashtags ?? ''}
                onChange={(e) => set('defaultHashtags', e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">پانویس کپشن</Label>
              <Input
                dir="rtl"
                placeholder="مثال: برای سفارش DM دهید"
                value={form.captionFooter ?? ''}
                onChange={(e) => set('captionFooter', e.target.value)}
              />
            </div>
          </div>
          <div className="n-card-compact flex items-center justify-between p-3">
            <div>
              <p className="text-sm font-semibold text-ink-primary">استفاده از اعداد فارسی</p>
              <p className="text-xs text-ink-tertiary">تبدیل خودکار اعداد لاتین به فارسی</p>
            </div>
            <Switch
              checked={form.persianDigits ?? true}
              onCheckedChange={(v) => set('persianDigits', v)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? 'در حال ذخیره…' : 'ذخیره کیت برند'}
            </Button>
          </div>
        </div>
      </div>

      {/* Live preview */}
      <div className="n-card p-5 h-fit sticky top-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-sm font-semibold text-ink-primary">پیش‌نمایش کپشن</h3>
        </div>
        <div className="n-card-compact p-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="size-8 rounded-full"
              style={{ background: form.brandPrimaryColor ?? '#0F766E' }}
            />
            <div>
              <p className="text-sm font-semibold text-ink-primary">{form.name ?? 'نام برند'}</p>
              <p className="text-2xs text-ink-tertiary">الان</p>
            </div>
          </div>
          <div
            className="aspect-square w-full rounded-xl mb-3"
            style={{ background: `${form.brandAccentColor ?? '#7c3aed'}22` }}
          />
          <p className="text-sm text-ink-primary leading-relaxed">
            محصول جدید ما عرضه شد! {form.brandVoice ? `با لحن ${form.brandVoice}` : ''}
            {' — '}
            {form.defaultCta ?? 'همین حالا سفارش دهید.'}
          </p>
          {form.captionFooter && (
            <p className="text-xs text-ink-tertiary mt-2 border-t border-border pt-2">
              {form.captionFooter}
            </p>
          )}
          {form.defaultHashtags && (
            <p className="text-xs mt-2" style={{ color: form.brandAccentColor ?? '#7c3aed' }}>
              {form.defaultHashtags}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Team ── */
function TeamTab() {
  const qc = useQueryClient()
  const { data: members, isLoading, isError, refetch } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => api.getPaginated<Member>('/api/members'),
  })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')

  // Wire to real backend POST /api/members/invite (Zod-validated, rate-limited, service-backed).
  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: string }) =>
      api.post('/api/members/invite', body),
    onSuccess: () => {
      toast.success('دعوت‌نامه با موفقیت ارسال شد.')
      announce('دعوت‌نامه ارسال شد')
      qc.invalidateQueries({ queryKey: ['members'] })
      setEmail('')
      setInviteOpen(false)
    },
    onError: (err: unknown) => {
      // API returns `{ error: "فارسی" }` JSON; fetcher wraps body text in Error.message.
      let msg = 'خطا در ارسال دعوت‌نامه'
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          if (typeof parsed?.error === 'string') msg = parsed.error
        } catch {
          msg = err.message
        }
      }
      toast.error(msg)
    },
  })

  const ROLE_COLOR: Record<string, string> = {
    admin: 'text-violet-700 bg-violet-50 border-violet-200',
    editor: 'text-accent bg-accent-soft border-accent/20',
    approver: 'text-amber-700 bg-amber-50 border-amber-200',
    viewer: 'text-slate-700 bg-slate-50 border-slate-200',
  }

  return (
    <div className="n-card p-0 overflow-hidden">
      <div className="p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">اعضای تیم</h2>
          <span className="text-xs text-ink-tertiary num-tabular">
            {toPersianDigits(members?.length ?? 0)} عضو
          </span>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="size-4" />
          دعوت عضو
        </Button>
      </div>
      <LoadingState
        isLoading={isLoading}
        isError={isError}
        onRetry={refetch}
        errorLabel="خطا در بارگذاری اعضای تیم"
        skeleton={
          <div className="p-4 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        }
      >
        {members && members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="عضوی یافت نشد"
            message="هنوز عضوی به تیم اضافه نشده است. با دعوت اولین عضو، همکاری تیمی را آغاز کنید."
            illustration="search"
            action={
              <Button size="sm" onClick={() => setInviteOpen(true)}>
                <Plus className="size-4" />
                دعوت عضو
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto thin-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                    عضو
                  </TableHead>
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">
                    ایمیل
                  </TableHead>
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                    نقش
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={m.id} className="border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-9">
                          {m.avatar && <AvatarImage src={m.avatar} alt={m.name} />}
                          <AvatarFallback className="text-sm">
                            {m.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-semibold text-ink-primary">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="hidden sm:table-cell text-sm text-ink-secondary"
                      dir="ltr"
                    >
                      {m.email}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-2xs font-bold px-2 py-0.5 rounded-full border',
                          ROLE_COLOR[m.role] ?? ROLE_COLOR.viewer
                        )}
                      >
                        {m.roleLabel}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </LoadingState>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-start">دعوت عضو جدید</DialogTitle>
            <DialogDescription className="text-start">
              برای دعوت به تیم، ایمیل و نقش کاربر را مشخص کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">ایمیل</Label>
              <Input
                dir="ltr"
                type="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-left"
              />
            </div>
            <div>
              <Label className="text-sm text-ink-secondary mb-1.5 block">نقش</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مدیر</SelectItem>
                  <SelectItem value="editor">ویراستار</SelectItem>
                  <SelectItem value="approver">تأییدکننده</SelectItem>
                  <SelectItem value="viewer">بیننده</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteOpen(false)}>
              انصراف
            </Button>
            <Button
              onClick={() => {
                if (!email) {
                  toast.error('ایمیل را وارد کنید.')
                  return
                }
                inviteMutation.mutate({ email, role })
              }}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'در حال ارسال…' : 'ارسال دعوت‌نامه'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* ── Billing ── */
//
// Issue #221: IRR billing with Zarinpal gateway integration.
// Shows current plan + real usage meters (channels / seats / posts), plan
// comparison cards with IRR prices, subscribe button (initiates Zarinpal
// payment), and invoice history pulled from /api/billing/invoices.
function BillingTab() {
  // Composite "current plan + usage" — single round-trip via /api/billing/current.
  const { data: current, isLoading: currentLoading } = useQuery<{
    subscription: {
      planCode: string
      planName: string
      status: string
      currentPeriodEnd: string | null
    } | null
    plan: BillingPlan
    usage: {
      channelsUsed: number
      channelsLimit: number
      seatsUsed: number
      seatsLimit: number
      postsThisMonth: number
      postsLimit: number
    }
  }>({
    queryKey: ['billing-current'],
    queryFn: () => api.get('/api/billing/current'),
  })

  const { data: plans } = useQuery<BillingPlan[]>({
    queryKey: ['billing-plans'],
    queryFn: () => api.get<{ data: BillingPlan[] }>('/api/billing/plans').then((r) => r.data),
  })
  const { data: invoices } = useQuery<{ data: BillingInvoice[] }>({
    queryKey: ['billing-invoices'],
    queryFn: () => api.get<{ data: BillingInvoice[] }>('/api/billing/invoices'),
  })

  const currentPlan = current?.plan ?? null
  const currentPlanCode = currentPlan?.code ?? 'free'

  // Subscribe mutation — initiates Zarinpal payment + redirects.
  const subscribeMutation = useMutation({
    mutationFn: async (planCode: string) => {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planCode }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'خطا در ارتباط با درگاه' }))
        throw new Error(err.error || 'خطا در ارتباط با درگاه')
      }
      return (await res.json()) as { paymentUrl: string }
    },
    onSuccess: (data) => {
      // Redirect the user to Zarinpal's checkout page.
      window.location.href = data.paymentUrl
    },
    onError: (err: Error) => {
      toast.error(err.message || 'خطا در شروع پرداخت')
    },
  })

  return (
    <div className="space-y-4">
      {/* Current plan + usage meters */}
      <div className="n-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-xs text-ink-tertiary mb-1">طرح فعلی</p>
            <p className="text-lg font-bold text-ink-primary">
              {currentPlan?.name ?? 'رایگان'}
            </p>
            <p className="text-sm text-ink-secondary mt-1">
              {currentPlan ? formatIRR(currentPlan.priceIRR) : '—'}
              {current?.subscription?.currentPeriodEnd && (
                <span className="text-ink-tertiary ms-2">
                  • تمدید: {formatJalali(new Date(current.subscription.currentPeriodEnd))}
                </span>
              )}
            </p>
          </div>
          {currentPlanCode !== 'free' && (
            <Button
              size="sm"
              variant="outline"
              className="n-focus-ring"
              onClick={() => toast.info('برای تغییر طرح با پشتیبانی تماس بگیرید.')}
            >
              تغییر طرح
            </Button>
          )}
        </div>
        {/* Usage meters — only show if we have plan limits */}
        {currentPlan && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <UsageMeter
              label="پلتفرم‌ها"
              used={currentLoading ? 0 : (current?.usage.channelsUsed ?? 0)}
              limit={currentPlan.maxChannels}
            />
            <UsageMeter
              label="کاربران"
              used={currentLoading ? 0 : (current?.usage.seatsUsed ?? 0)}
              limit={currentPlan.maxSeats}
            />
            <UsageMeter
              label="پست‌های این ماه"
              used={currentLoading ? 0 : (current?.usage.postsThisMonth ?? 0)}
              limit={currentPlan.maxPostsPerMonth}
            />
          </div>
        )}
      </div>

      {/* Plan comparison cards */}
      <div>
        <p className="text-sm font-bold text-ink-primary mb-3">طرح‌های موجود</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(plans ?? []).map((plan) => {
            const isCurrent = plan.code === currentPlanCode
            const isFree = plan.code === 'free'
            return (
              <div
                key={plan.id}
                className={cn(
                  'n-card p-5 flex flex-col',
                  plan.code === 'pro' && 'ring-2 ring-accent/30'
                )}
              >
                {plan.code === 'pro' && (
                  <span className="self-start text-2xs font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent mb-2">
                    محبوب‌ترین
                  </span>
                )}
                <p className="text-base font-bold text-ink-primary">{plan.name}</p>
                <p className="text-xl font-bold text-ink-primary mt-1">
                  {formatIRR(plan.priceIRR)}
                </p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  <li className="flex items-start gap-1.5 text-xs text-ink-secondary">
                    <Check className="size-3 text-success shrink-0 mt-0.5" />
                    <span>{toPersianDigits(plan.maxChannels)} پلتفرم</span>
                  </li>
                  <li className="flex items-start gap-1.5 text-xs text-ink-secondary">
                    <Check className="size-3 text-success shrink-0 mt-0.5" />
                    <span>{toPersianDigits(plan.maxSeats)} کاربر</span>
                  </li>
                  <li className="flex items-start gap-1.5 text-xs text-ink-secondary">
                    <Check className="size-3 text-success shrink-0 mt-0.5" />
                    <span>
                      {plan.maxPostsPerMonth === -1
                        ? 'پست نامحدود'
                        : `${toPersianDigits(plan.maxPostsPerMonth)} پست در ماه`}
                    </span>
                  </li>
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-ink-secondary">
                      <Check className="size-3 text-success shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? 'outline' : 'default'}
                  size="sm"
                  className="w-full mt-3 n-focus-ring"
                  disabled={isCurrent || subscribeMutation.isPending}
                  onClick={() => {
                    if (isFree) {
                      toast.info('طرح رایگان فعال است')
                      return
                    }
                    subscribeMutation.mutate(plan.code)
                  }}
                >
                  {isCurrent
                    ? 'طرح فعلی'
                    : subscribeMutation.isPending
                      ? 'در حال اتصال به درگاه…'
                      : isFree
                        ? 'فعال‌سازی رایگان'
                        : 'ارتقا به این طرح'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      {/* Invoice history */}
      <div className="n-card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-ink-primary">تاریخچه فاکتورها</h2>
        </div>
        {(invoices?.data ?? []).length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <div className="flex justify-center">
              <Receipt className="size-8 text-ink-tertiary" />
            </div>
            <p className="text-sm text-ink-secondary">هنوز فاکتوری صادر نشده</p>
            <p className="text-xs text-ink-tertiary">
              پس از اولین پرداخت موفق، فاکتورهای شما اینجا نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto thin-scrollbar">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold">طرح</TableHead>
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold">مبلغ</TableHead>
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold">وضعیت</TableHead>
                  <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">تاریخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(invoices?.data ?? []).map((inv) => (
                  <TableRow key={inv.id} className="border-border">
                    <TableCell className="text-sm text-ink-primary">{inv.planName}</TableCell>
                    <TableCell className="text-sm text-ink-primary num-tabular">{formatIRR(inv.amountIRR)}</TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-2xs font-bold px-2 py-0.5 rounded-full',
                          inv.status === 'paid'
                            ? 'bg-success-soft text-success'
                            : inv.status === 'failed'
                              ? 'bg-danger-soft text-danger'
                              : 'bg-warning-soft text-warning'
                        )}
                      >
                        {inv.status === 'paid' ? 'پرداخت‌شده' : inv.status === 'failed' ? 'ناموفق' : 'در انتظار'}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-xs text-ink-secondary">
                      {inv.paidAt ? formatJalali(new Date(inv.paidAt)) : formatJalali(new Date(inv.createdAt))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}

interface BillingPlan {
  id: string
  code: string
  name: string
  priceIRR: string
  maxChannels: number
  maxSeats: number
  maxPostsPerMonth: number
  features: string[]
  isActive: boolean
}

interface BillingInvoice {
  id: string
  workspaceId: string
  planId: string
  planName: string
  amountIRR: string
  status: string
  paidAt: string | null
  zarinpalAuthority: string | null
  zarinpalRefId: string | null
  createdAt: string
}

/** Format an IRR amount string as "۲۹۰,۰۰۰ تومان". */
function formatIRR(amountStr: string): string {
  const n = Number(amountStr ?? 0)
  if (n === 0) return 'رایگان'
  // IRR → Tomans (÷10) for display, per Iranian convention.
  const toman = Math.round(n / 10)
  return `${toPersianDigits(toman.toLocaleString('en-US'))} تومان`
}

/** Usage meter — a label, a "used / limit" count, and a progress bar. */
function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string
  used: number
  limit: number
}) {
  const isUnlimited = limit === -1
  const pct = isUnlimited ? 0 : limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const isOver = !isUnlimited && used >= limit
  return (
    <div className="n-card-compact p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ink-secondary">{label}</span>
        <span
          className={cn(
            'text-xs font-bold num-tabular',
            isOver ? 'text-danger' : 'text-ink-primary'
          )}
        >
          {toPersianDigits(used)} / {isUnlimited ? '∞' : toPersianDigits(limit)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isOver ? 'bg-danger' : pct > 80 ? 'bg-warning' : 'bg-accent'
          )}
          style={{ width: `${isUnlimited ? 0 : pct}%` }}
        />
      </div>
    </div>
  )
}

/* ── UTM Presets ── */
function UtmSection() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', source: '', medium: '', campaign: '' })

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['utm-presets'],
    queryFn: () => api.get<{ id: string; name: string; source: string; medium: string; campaign: string; isDefault: boolean }[]>('/api/utm-presets'),
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      api.post('/api/utm-presets', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['utm-presets'] })
      setShowForm(false)
      setForm({ name: '', source: '', medium: '', campaign: '' })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/api/utm-presets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['utm-presets'] }),
  })

  return (
    <div className="n-card p-5 space-y-5 max-w-2xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link2 className="size-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink-primary">پیش‌تنظیم‌های UTM</h2>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'انصراف' : '+ پیش‌تنظیم جدید'}
        </Button>
      </div>

      <p className="text-xs text-ink-secondary">
        پیش‌تنظیم‌های UTM برای ردیابی ترافیک از شبکه‌های اجتماعی به وب‌سایت شما.
      </p>

      {showForm && (
        <div className="n-card-compact p-4 border border-border rounded-xl space-y-3">
          <p className="text-xs font-semibold text-ink-primary">پیش‌تنظیم جدید</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">نام</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Instagram Organic" className="text-sm" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">منبع (source)</Label>
              <Input value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="instagram" className="text-sm" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">رسانه (medium)</Label>
              <Input value={form.medium} onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value }))} placeholder="social" className="text-sm" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">کمپین (campaign)</Label>
              <Input value={form.campaign} onChange={(e) => setForm((f) => ({ ...f, campaign: e.target.value }))} placeholder="spring_2026" className="text-sm" dir="ltr" />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => createMutation.mutate(form)}
            disabled={!form.name || !form.source || !form.medium || createMutation.isPending}
          >
            {createMutation.isPending ? 'در حال ذخیره…' : 'ذخیره پیش‌تنظیم'}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : presets.length === 0 ? (
        <div className="text-center py-8 text-ink-tertiary">
          <Link2 className="size-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">هنوز پیش‌تنظیمی ندارید</p>
          <p className="text-xs mt-1">پیش‌تنظیم بسازید تا در ویرایشگر پست استفاده کنید</p>
        </div>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div key={preset.id} className="n-card-compact flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-ink-primary">{preset.name}</span>
                  {preset.isDefault && (
                    <span className="text-2xs bg-accent/10 text-accent rounded-full px-1.5 py-0.5">پیش‌فرض</span>
                  )}
                </div>
                <span className="text-xs text-ink-tertiary font-mono">{preset.source}/{preset.medium}{preset.campaign ? `/${preset.campaign}` : ''}</span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => deleteMutation.mutate(preset.id)}
                disabled={deleteMutation.isPending}
                className="text-danger hover:text-danger hover:bg-danger-soft shrink-0"
              >
                حذف
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── Notifications ── */
//
// Issue #213 / settings-brandkit: previously the whole tab was disabled with
// a "به‌زودی" badge. Now wired to GET/PATCH /api/notifications/preferences —
// per-user, per-category, per-channel (in-app / email / push) toggles. The
// switches update optimistically and roll back on error.
function NotificationsTab() {
  const qc = useQueryClient()
  const { data, isLoading, isError, refetch } = useQuery<NotificationPrefs>({
    queryKey: ['notification-preferences'],
    queryFn: () => api.get<NotificationPrefs>('/api/notifications/preferences'),
    // Don't retry on 401/403 — the user is logged in, those are real denials.
    retry: false,
  })

  const updateMutation = useMutation({
    mutationFn: (body: Partial<NotificationPrefs>) =>
      api.patch<NotificationPrefs>('/api/notifications/preferences', body),
    onSuccess: (updated) => {
      qc.setQueryData(['notification-preferences'], updated)
    },
    onError: (err: unknown) => {
      let msg = 'ذخیره تنظیمات اعلان ناموفق بود'
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message)
          if (typeof parsed?.error === 'string') msg = parsed.error
        } catch {
          msg = err.message
        }
      }
      toast.error(msg)
      // Roll back to the last known good value.
      qc.invalidateQueries({ queryKey: ['notification-preferences'] })
    },
  })

  const toggle = (
    categoryId: string,
    channel: 'inApp' | 'email' | 'push',
    next: boolean,
  ) => {
    const current = data ?? {}
    const prev = current[categoryId] ?? { email: false, push: false, inApp: false }
    const updated: NotificationPrefs = {
      ...current,
      [categoryId]: { ...prev, [channel]: next },
    }
    // Optimistic update.
    qc.setQueryData<NotificationPrefs>(['notification-preferences'], updated)
    updateMutation.mutate({
      [categoryId]: { ...prev, [channel]: next },
    })
  }

  if (isError) {
    return <ErrorState label="خطا در بارگذاری تنظیمات اعلان" onRetry={refetch} />
  }

  return (
    <div className="n-card p-5 max-w-3xl">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="size-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-primary">تنظیمات اعلان‌ها</h2>
      </div>

      <div className="space-y-2">
        {NOTIFICATION_TOGGLES.map((t) => {
          const Icon = t.icon
          const prefs = data?.[t.id] ?? {
            inApp: t.defaultOn,
            email: t.defaultOn,
            push: t.defaultOn,
          }
          return (
            <div
              key={t.id}
              className="n-card-compact p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-accent-soft flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">{t.label}</p>
                  <p className="text-xs text-ink-tertiary">{t.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 ms-12 sm:ms-0">
                {NOTIFICATION_CHANNELS.map((c) => (
                  <div key={c.key} className="flex items-center gap-2">
                    <Label
                      htmlFor={`notif-${t.id}-${c.key}`}
                      className="text-2xs text-ink-tertiary cursor-pointer select-none"
                    >
                      {c.label}
                    </Label>
                    <Switch
                      id={`notif-${t.id}-${c.key}`}
                      checked={prefs[c.key]}
                      disabled={isLoading || updateMutation.isPending}
                      onCheckedChange={(v) => toggle(t.id, c.key, v)}
                      aria-label={`${t.label} — ${c.label}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-2xs text-ink-tertiary mt-4 leading-relaxed">
        این تنظیمات برای حساب کاربری شما اعمال می‌شود و در همه دستگاه‌ها یکسان است.
        اعلان‌های حیاتی (مثل شکست انتشار) حتی در صورت غیرفعال بودن، در صفحه اعلان‌ها نمایش داده می‌شوند.
      </p>
    </div>
  )
}
