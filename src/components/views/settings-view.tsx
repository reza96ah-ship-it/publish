'use client'

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Settings as SettingsIcon,
  Building2,
  Palette,
  Users,
  CreditCard,
  Bell,
  Plus,
  Eye,
  Hash,
  Check,
  Sparkles,
} from 'lucide-react'

import { api } from '@/lib/api'
import { toPersianDigits, formatJalali } from '@/lib/jalali'
import { announce } from '@/lib/aria-live'
import {
  SectionTitle,
  Skeleton,
  LoadingState,
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
  const [tab, setTab] = useState<'overview' | 'brand' | 'team' | 'billing' | 'notifications'>(
    'overview'
  )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
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
      </Tabs>
    </motion.div>
  )
}

/* ── Overview ── */
function OverviewTab() {
  const { data: ws, isLoading } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
  })
  // Mount the inner form once we have data, so useState initializer picks it up.
  if (isLoading || !ws) {
    return (
      <div className="n-card n-gradient-border p-5 max-w-2xl">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="size-4 text-accent" />
          <h2 className="text-sm font-[600] text-ink-primary">پروفایل فضای کار</h2>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </div>
    )
  }
  return <OverviewForm ws={ws} />
}

function OverviewForm({ ws }: { ws: Workspace }) {
  const [form, setForm] = useState<Partial<Workspace>>(ws)
  const set = (key: keyof Workspace, value: string) => setForm((cur) => ({ ...cur, [key]: value }))

  return (
    <div className="n-card n-gradient-border p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Building2 className="size-4 text-accent" />
        <h2 className="text-sm font-[600] text-ink-primary">پروفایل فضای کار</h2>
      </div>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">نام فضای کار</Label>
            <Input
              dir="rtl"
              value={form.name ?? ''}
              onChange={(e) => set('name', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">دسته‌بندی</Label>
            <Input
              dir="rtl"
              value={form.category ?? ''}
              onChange={(e) => set('category', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">تلفن</Label>
            <Input
              dir="ltr"
              value={form.phone ?? ''}
              onChange={(e) => set('phone', e.target.value)}
              className="text-left"
            />
          </div>
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">منطقه زمانی</Label>
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
          <Label className="text-[12px] text-ink-secondary mb-1.5 block">توضیحات</Label>
          <Textarea
            dir="rtl"
            rows={3}
            value={form.description ?? ''}
            onChange={(e) => set('description', e.target.value)}
            className="resize-none"
          />
        </div>
        <Button
          onClick={() => {
            toast.success('تغییرات پروفایل ذخیره شد.')
            announce('تنظیمات ذخیره شد')
          }}
        >
          ذخیره تغییرات
        </Button>
      </div>
    </div>
  )
}

/* ── Brand ── */
function BrandTab() {
  const { data: ws, isLoading } = useQuery<Workspace>({
    queryKey: ['workspace'],
    queryFn: () => api.get<Workspace>('/api/workspace'),
  })
  if (isLoading || !ws) {
    return (
      <div className="n-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="size-4 text-accent" />
          <h2 className="text-sm font-[600] text-ink-primary">کیت برند</h2>
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 n-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Palette className="size-4 text-accent" />
          <h2 className="text-sm font-[600] text-ink-primary">کیت برند</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">رنگ اصلی</Label>
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
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">رنگ تأکید</Label>
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
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">لحن برند</Label>
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
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">CTA پیش‌فرض</Label>
            <Input
              dir="rtl"
              placeholder="مثال: همین حالا سفارش دهید"
              value={form.defaultCta ?? ''}
              onChange={(e) => set('defaultCta', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-[12px] text-ink-secondary mb-1.5 block">
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
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">
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
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">پانویس کپشن</Label>
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
              <p className="text-[12px] font-[600] text-ink-primary">استفاده از اعداد فارسی</p>
              <p className="text-[11px] text-ink-tertiary">تبدیل خودکار اعداد لاتین به فارسی</p>
            </div>
            <Switch
              checked={form.persianDigits ?? true}
              onCheckedChange={(v) => set('persianDigits', v)}
            />
          </div>
          <Button
            onClick={() => {
              toast.success('کیت برند با موفقیت ذخیره شد.')
              announce('تنظیمات ذخیره شد')
            }}
          >
            ذخیره کیت برند
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="n-card p-5 h-fit sticky top-4">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-4 text-accent" />
          <h3 className="text-sm font-[600] text-ink-primary">پیش‌نمایش کپشن</h3>
        </div>
        <div className="n-card-compact p-4">
          <div className="flex items-center gap-2 mb-3">
            <span
              className="size-8 rounded-full"
              style={{ background: form.brandPrimaryColor ?? '#0F766E' }}
            />
            <div>
              <p className="text-[12px] font-[600] text-ink-primary">{form.name ?? 'نام برند'}</p>
              <p className="text-[10px] text-ink-tertiary">الان</p>
            </div>
          </div>
          <div
            className="aspect-square w-full rounded-xl mb-3"
            style={{ background: `${form.brandAccentColor ?? '#2563EB'}22` }}
          />
          <p className="text-[12px] text-ink-primary leading-relaxed">
            محصول جدید ما عرضه شد! {form.brandVoice ? `با لحن ${form.brandVoice}` : ''}
            {' — '}
            {form.defaultCta ?? 'همین حالا سفارش دهید.'}
          </p>
          {form.captionFooter && (
            <p className="text-[11px] text-ink-tertiary mt-2 border-t border-border pt-2">
              {form.captionFooter}
            </p>
          )}
          {form.defaultHashtags && (
            <p className="text-[11px] mt-2" style={{ color: form.brandAccentColor ?? '#2563EB' }}>
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
  const { data: members, isLoading } = useQuery<Member[]>({
    queryKey: ['members'],
    queryFn: () => api.getPaginated<Member>('/api/members'),
  })
  const [inviteOpen, setInviteOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('editor')

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
          <h2 className="text-sm font-[600] text-ink-primary">اعضای تیم</h2>
          <span className="text-[11px] text-ink-tertiary num-tabular">
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
                  <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                    عضو
                  </TableHead>
                  <TableHead className="text-right text-[11px] text-ink-tertiary font-[700] hidden sm:table-cell">
                    ایمیل
                  </TableHead>
                  <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
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
                          <AvatarFallback className="text-[12px]">
                            {m.name.slice(0, 1)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-[13px] font-[600] text-ink-primary">{m.name}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="hidden sm:table-cell text-[12px] text-ink-secondary"
                      dir="ltr"
                    >
                      {m.email}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          'text-[10px] font-[700] px-2 py-0.5 rounded-full border',
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
            <DialogTitle className="text-right">دعوت عضو جدید</DialogTitle>
            <DialogDescription className="text-right">
              برای دعوت به تیم، ایمیل و نقش کاربر را مشخص کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">ایمیل</Label>
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
              <Label className="text-[12px] text-ink-secondary mb-1.5 block">نقش</Label>
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
                toast.success('دعوت‌نامه با موفقیت ارسال شد.')
                setEmail('')
                setInviteOpen(false)
              }}
            >
              ارسال دعوت‌نامه
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
            <p className="text-[11px] text-ink-tertiary mb-1">طرح فعلی</p>
            <p className="text-lg font-[700] text-ink-primary">
              {planLabel[currentPlan] ?? currentPlan}
            </p>
            <p className="text-[12px] text-ink-secondary mt-1">
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
        <p className="text-[12px] font-[700] text-ink-primary mb-3">طرح‌های موجود</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLAN_TIERS.map((tier) => {
            const isCurrent = tier.id === currentPlan
            return (
              <div
                key={tier.id}
                className={cn('n-card p-5 flex flex-col', tier.popular && 'ring-2 ring-accent/30')}
              >
                {tier.popular && (
                  <span className="self-start text-[10px] font-[700] px-2 py-0.5 rounded-full bg-accent-soft text-accent mb-2">
                    محبوب‌ترین
                  </span>
                )}
                <p className="text-[14px] font-[700] text-ink-primary">{tier.name}</p>
                <p className="text-[18px] font-[700] text-ink-primary mt-1">{tier.priceLabel}</p>
                <ul className="mt-3 space-y-1.5 flex-1">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-1.5 text-[11px] text-ink-secondary">
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
          <h2 className="text-sm font-[600] text-ink-primary">تاریخچه فاکتورها</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                شماره فاکتور
              </TableHead>
              <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                تاریخ
              </TableHead>
              <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                مبلغ
              </TableHead>
              <TableHead className="text-right text-[11px] text-ink-tertiary font-[700]">
                وضعیت
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow className="border-border">
              <TableCell className="text-[12px] font-[600] text-ink-primary" dir="ltr">
                INV-1403-003
              </TableCell>
              <TableCell className="text-[12px] text-ink-secondary">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 30))}
              </TableCell>
              <TableCell className="text-[12px] text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-[10px] bg-success-soft text-success border-success/20"
                  variant="outline"
                >
                  پرداخت‌شده
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow className="border-border">
              <TableCell className="text-[12px] font-[600] text-ink-primary" dir="ltr">
                INV-1403-002
              </TableCell>
              <TableCell className="text-[12px] text-ink-secondary">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 60))}
              </TableCell>
              <TableCell className="text-[12px] text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-[10px] bg-success-soft text-success border-success/20"
                  variant="outline"
                >
                  پرداخت‌شده
                </Badge>
              </TableCell>
            </TableRow>
            <TableRow className="border-border">
              <TableCell className="text-[12px] font-[600] text-ink-primary" dir="ltr">
                INV-1403-001
              </TableCell>
              <TableCell className="text-[12px] text-ink-secondary">
                {formatJalali(new Date(Date.now() - 1000 * 60 * 60 * 24 * 90))}
              </TableCell>
              <TableCell className="text-[12px] text-ink-primary num-tabular">
                {toPersianDigits('۲۹۰,۰۰۰')} تومان
              </TableCell>
              <TableCell>
                <Badge
                  className="text-[10px] bg-success-soft text-success border-success/20"
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
  )
}

/* ── Notifications ── */
function NotificationsTab() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(NOTIFICATION_TOGGLES.map((t) => [t.id, t.defaultOn]))
  )

  return (
    <div className="n-card p-5 max-w-2xl">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="size-4 text-accent" />
        <h2 className="text-sm font-[600] text-ink-primary">تنظیمات اعلان‌ها</h2>
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
                  <p className="text-[13px] font-[600] text-ink-primary">{t.label}</p>
                  <p className="text-[11px] text-ink-tertiary">{t.desc}</p>
                </div>
              </div>
              <Switch
                checked={toggles[t.id]}
                onCheckedChange={(v) => {
                  setToggles((cur) => ({ ...cur, [t.id]: v }))
                  toast.success(`${t.label} ${v ? 'فعال شد' : 'غیرفعال شد'}.`)
                }}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
