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
} from 'lucide-react'

import { api } from '@/lib/api'
import { CommentDmRulesPanel } from '@/components/automation/comment-dm-rules'
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
import { Badge } from '@/components/ui/badge'
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

const PLAN_TIERS = [
  {
    id: 'free',
    name: 'رایگان',
    price: 0,
    priceLabel: 'رایگان',
    features: ['۱ پلتفرم', '۱۰ پست در ماه', '۱ کاربر', 'تقویم شمسی', 'اپلیکیشن موبایل'],
    current: false,
  },
  {
    id: 'pro',
    name: 'حرفه‌ای',
    price: 290000,
    priceLabel: '۲۹۰,۰۰۰ تومان/ماه',
    features: [
      '۵ پلتفرم',
      'نامحدود پست',
      '۵ کاربر',
      'تحلیل‌های پیشرفته',
      'اتوماسیون کامنت به DM',
      'پشتیبانی اولویت‌دار',
    ],
    current: false,
    popular: true,
  },
  {
    id: 'agency',
    name: 'آژانس',
    price: 890000,
    priceLabel: '۸۹۰,۰۰۰ تومان/ماه',
    features: [
      'پلتفرم‌های نامحدود',
      '۱۰ کاربر',
      'نقش‌های سفارشی',
      'برند چندگانه',
      'گزارش‌های سفارشی',
      'API دسترسی',
    ],
    current: false,
  },
  {
    id: 'enterprise',
    name: 'سازمانی',
    price: null,
    priceLabel: 'تماس بگیرید',
    features: [
      'بدون محدودیت',
      'کاربران نامحدود',
      'SSO و SAML',
      'SLA 99.9٪',
      'پشتیبانی اختصاصی',
      'آموزش تیمی',
    ],
    current: false,
  },
]

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
]

export function SettingsView() {
  const [tab, setTab] = useState<'overview' | 'brand' | 'team' | 'billing' | 'notifications' | 'utm' | 'automation'>(
    'overview'
  )

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
  const [form, setForm] = useState<Partial<Workspace>>(ws)
  const set = (key: keyof Workspace, value: string) => setForm((cur) => ({ ...cur, [key]: value }))

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
          <Button disabled>
            ذخیره تغییرات
          </Button>
          <Badge variant="outline" className="text-ink-tertiary">
            به‌زودی
          </Badge>
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
  const [form, setForm] = useState<Partial<Workspace>>(ws)
  const set = (key: keyof Workspace, value: string | boolean) =>
    setForm((cur) => ({ ...cur, [key]: value }))

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
                  value={form.brandAccentColor ?? '#2563EB'}
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
            <Button disabled>
              ذخیره کیت برند
            </Button>
            <Badge variant="outline" className="text-ink-tertiary">
              به‌زودی
            </Badge>
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
            style={{ background: `${form.brandAccentColor ?? '#2563EB'}22` }}
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
            <p className="text-xs mt-2" style={{ color: form.brandAccentColor ?? '#2563EB' }}>
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
    editor: 'text-blue-700 bg-blue-50 border-blue-200',
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
function BillingTab() {
  const { data: ws } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
  })

  const planLabel: Record<string, string> = {
    free: 'رایگان',
    pro: 'حرفه‌ای',
    agency: 'آژانس',
    enterprise: 'سازمانی',
  }

  const currentPlan = ws?.plan ?? 'free'

  return (
    <div className="space-y-4">
      <div className="n-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-ink-tertiary mb-1">طرح فعلی</p>
            <p className="text-lg font-bold text-ink-primary">
              {planLabel[currentPlan] ?? currentPlan}
            </p>
            <p className="text-sm text-ink-secondary mt-1">
              {PLAN_TIERS.find((t) => t.id === currentPlan)?.priceLabel ?? '—'}
            </p>
          </div>
          <Button onClick={() => toast.info('ارتقا طرح به‌زودی فعال خواهد شد.')}>
            <CreditCard className="size-4" />
            ارتقا طرح
          </Button>
        </div>
      </div>

      <div>
        <p className="text-sm font-bold text-ink-primary mb-3">طرح‌های موجود</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLAN_TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlan
            return (
              <div
                key={tier.id}
                className={cn('n-card p-5 flex flex-col', tier.popular && 'ring-2 ring-accent/30')}
              >
                {tier.popular && (
                  <span className="self-start text-2xs font-bold px-2 py-0.5 rounded-full bg-accent-soft text-accent mb-2">
                    محبوب‌ترین
                  </span>
                )}
                <p className="text-base font-bold text-ink-primary">{tier.name}</p>
                <p className="text-xl font-bold text-ink-primary mt-1">{tier.priceLabel}</p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-ink-secondary">
                      <Check className="size-3 text-success shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? 'outline' : 'default'}
                  size="sm"
                  className="w-full mt-3"
                  disabled={isCurrent}
                  onClick={() => toast.info(`ارتقا به طرح ${tier.name} به‌زودی فعال خواهد شد.`)}
                >
                  {isCurrent ? 'طرح فعلی' : 'انتخاب این طرح'}
                </Button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="n-card p-0 overflow-hidden">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-ink-primary">تاریخچه فاکتورها</h2>
        </div>
        <div className="overflow-x-auto thin-scrollbar">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                شماره فاکتور
              </TableHead>
              <TableHead className="text-start text-xs text-ink-tertiary font-bold hidden sm:table-cell">
                تاریخ
              </TableHead>
              <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                مبلغ
              </TableHead>
              <TableHead className="text-start text-xs text-ink-tertiary font-bold">
                وضعیت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-border">
              <TableCell className="text-sm font-semibold text-ink-primary" dir="ltr">
                INV-1403-003
              </TableCell>
              <TableCell className="text-sm text-ink-secondary hidden sm:table-cell">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))}
              </TableCell>
              <TableCell className="text-sm text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-2xs bg-success-soft text-success border-success/20"
                  variant="outline"
                >
                  پرداخت‌شده
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow className="border-border">
              <TableCell className="text-sm font-semibold text-ink-primary" dir="ltr">
                INV-1403-002
              </TableCell>
              <TableCell className="text-sm text-ink-secondary hidden sm:table-cell">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 60))}
              </TableCell>
              <TableCell className="text-sm text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-2xs bg-success-soft text-success border-success/20"
                  variant="outline"
                >
                  پرداخت‌شده
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow className="border-border">
              <TableCell className="text-sm font-semibold text-ink-primary" dir="ltr">
                INV-1403-001
              </TableCell>
              <TableCell className="text-sm text-ink-secondary hidden sm:table-cell">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90))}
              </TableCell>
              <TableCell className="text-sm text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-2xs bg-success-soft text-success border-success/20"
                  variant="outline"
                >
                  پرداخت‌شده
                </Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        </div>
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
function NotificationsTab() {
  return (
    <div className="n-card p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="size-4 text-accent" />
        <h2 className="text-sm font-semibold text-ink-primary">تنظیمات اعلان‌ها</h2>
        <Badge variant="outline" className="text-ink-tertiary">
          به‌زودی
        </Badge>
      </div>
      <div className="space-y-2">
        {NOTIFICATION_TOGGLES.map((t) => {
          const Icon = t.icon
          return (
            <div key={t.id} className="n-card-compact flex items-center justify-between p-3">
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-xl bg-accent-soft flex items-center justify-center">
                  <Icon className="size-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-primary">{t.label}</p>
                  <p className="text-xs text-ink-tertiary">{t.desc}</p>
                </div>
              </div>
              <Switch
                checked={t.defaultOn}
                disabled
                aria-label={t.label}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
