'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Loader2, AlertCircle, BarChart3, Clock,
  CheckCircle2, MoreHorizontal, MessageCircle, Heart,
  Share2, ShieldCheck, Eye, EyeOff,
} from 'lucide-react'
import { ease, useShouldAnimate } from '@/lib/motion'
import { TelegramLogo, InstagramLogo } from '@/components/ui/platform-logo'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface SignInFormProps {
  callbackUrl: string
  error?: string
}

function mapAuthError(code?: string): string | null {
  if (!code) return null
  switch (code) {
    case 'CredentialsSignin': return 'نشانی ایمیل یا رمز عبور اشتباه است'
    case 'Callback':          return 'خطا در ورود — لطفاً دوباره تلاش کنید'
    case 'Configuration':     return 'خطای پیکربندی سرور'
    case 'AccessDenied':      return 'دسترسی رد شد'
    case 'SessionExpired':    return 'نشست شما منقضی شده — دوباره وارد شوید'
    default:                  return 'خطا در ورود'
  }
}

// ── کارت‌های محصول — ردیف بالا + کارت پست پایین ─────────────────
function DashboardMockup() {
  const shouldAnimate = useShouldAnimate()

  const cardHover = {
    scale: 1.03,
    y: -6,
    transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number] },
  }

  return (
    <div className="w-full max-w-[470px] mx-auto mt-6 select-none">

      {/* ردیف اول: تقویم + نرخ تعامل */}
      <div className="flex gap-3 items-start mb-4">

        {/* کارت تقویم انتشار */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: ease.enter, delay: 0.12 }}
          whileHover={cardHover}
          className="flex-1 cursor-default"
          style={{ rotate: -2, willChange: 'transform' }}
        >
          <div className="n-card n-card-compact bg-surface/95 border-border shadow-popover overflow-hidden">
            <div className="p-3 pb-2 border-b border-border flex items-center justify-between">
              <span className="text-sm font-bold text-ink-primary">تقویم انتشار</span>
              <Badge variant="secondary" className="bg-canvas text-ink-secondary text-2xs font-medium border-0 px-2 py-0.5">امروز</Badge>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-canvas border border-border">
                <div className="size-7 rounded-md bg-surface flex items-center justify-center shrink-0">
                  <TelegramLogo className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink-primary leading-tight truncate">معرفی زمان‌بندی هوشمند محتوا</p>
                  <p className="text-2xs text-ink-secondary mt-0.5 flex items-center gap-1 num-tabular">
                    <Clock className="size-3 text-info shrink-0" /> دوشنبه ۲۴ اردیبهشت · ۱۰:۳۰
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-canvas border border-border">
                <div className="size-7 rounded-md bg-surface flex items-center justify-center shrink-0">
                  <InstagramLogo className="size-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-ink-primary leading-tight truncate">مرور عملکرد محتوای هفته</p>
                  <p className="text-2xs text-ink-secondary mt-0.5 flex items-center gap-1">
                    <CheckCircle2 className="size-3 text-success shrink-0" /> منتشرشده
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* کارت نرخ تعامل */}
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: ease.enter, delay: 0.22 }}
          whileHover={cardHover}
          className="flex-1 cursor-default"
          style={{ rotate: 2, willChange: 'transform' }}
        >
          <div className="n-card n-card-compact bg-surface/95 border border-border shadow-popover overflow-hidden">
            <div className="p-3 pb-2">
              <p className="text-2xs font-bold text-ink-tertiary tracking-wider mb-2">نرخ تعامل</p>
              <div className="flex items-end justify-between mb-0.5">
                <p className="text-xl font-extrabold text-ink-primary num-tabular">۴.۸٪</p>
                <span className="text-2xs font-bold text-success bg-success/10 rounded-md px-1.5 py-0.5 num-tabular">
                  ↑ ۱۲.۵٪
                </span>
              </div>
              <p className="text-2xs text-ink-tertiary">نسبت به هفته قبل</p>
            </div>
            <div className="px-3 pb-3 space-y-2.5">
              <div>
                <div className="flex justify-between text-2xs mb-1 font-medium">
                  <span className="text-ink-secondary">اینستاگرام</span>
                  <span className="text-ink-primary font-bold num-tabular">۵.۲٪</span>
                </div>
                <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden">
                  <motion.div
                    initial={shouldAnimate ? { width: 0 } : false}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, delay: 0.7, ease: ease.enter }}
                    className="h-full bg-accent rounded-full"
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-2xs mb-1 font-medium">
                  <span className="text-ink-secondary">تلگرام</span>
                  <span className="text-ink-primary font-bold num-tabular">۳.۹٪</span>
                </div>
                <div className="h-1.5 w-full bg-canvas rounded-full overflow-hidden">
                  <motion.div
                    initial={shouldAnimate ? { width: 0 } : false}
                    animate={{ width: '75%' }}
                    transition={{ duration: 1.2, delay: 0.85, ease: ease.enter }}
                    className="h-full bg-info rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

      </div>

      {/* ردیف دوم: کارت پست — وسط‌چین */}
      <div className="flex justify-center">
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: ease.enter, delay: 0.34 }}
          whileHover={cardHover}
          className="cursor-default"
          style={{ width: 210, willChange: 'transform' }}
        >
          <div className="n-card bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden">
            <div className="p-2.5 flex items-center justify-between border-b border-border bg-surface">
              <div className="flex items-center gap-2">
                <Avatar className="size-7 border border-border">
                  <AvatarFallback className="bg-accent/15 text-accent text-2xs font-bold">NS</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-xs font-bold text-ink-primary leading-none">Nashrino</p>
                  <p className="text-2xs text-ink-tertiary mt-0.5">زمان‌بندی‌شده</p>
                </div>
              </div>
              <MoreHorizontal className="size-3.5 text-ink-tertiary" />
            </div>
            <div className="w-full aspect-square overflow-hidden">
              <img
                src="/images/post-preview.jpg"
                alt="پیش‌نمایش پست"
                className="w-full h-full object-cover object-center"
              />
            </div>
            <div className="p-2.5 bg-surface">
              <div className="flex items-center gap-2.5 mb-1.5">
                <Heart className="size-3.5 text-danger fill-danger" />
                <MessageCircle className="size-3.5 text-ink-secondary" />
                <Share2 className="size-3.5 text-ink-secondary" />
              </div>
              <p className="text-2xs text-ink-primary font-bold num-tabular">۲٬۴۵۱ پسند</p>
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  )
}

export function SignInForm({ callbackUrl, error }: SignInFormProps) {
  const [email, setEmail]             = useState('')
  const [password, setPassword]       = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [csrfToken, setCsrfToken]     = useState('')
  const [pending, setPending]         = useState(false)
  const errorMessage = mapAuthError(error)
  const shouldAnimate = useShouldAnimate()

  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((r) => r.json())
      .then((d) => setCsrfToken(d.csrfToken))
      .catch(() => {})
  }, [])

  function fillDemo() {
    setEmail('demo@nashrino.ir')
    setPassword('demo1234')
  }

  return (
    // RTL grid: first DOM child → RIGHT column, second → LEFT column
    <main
      className="min-h-dvh grid lg:grid-cols-[1fr_1.8fr] bg-canvas text-ink-primary font-sans selection:bg-accent/20"
      dir="rtl"
    >

      {/* ── Section 1: فرم ورود — ستون راست ───────────────── */}
      <section className="flex flex-col items-center justify-center p-8 sm:p-12 relative z-20 bg-canvas">
        <motion.div
          initial={shouldAnimate ? { opacity: 0, y: 16 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: ease.enter }}
          className="w-full max-w-[400px]"
        >
          {/* لوگو و برند */}
          <div className="flex flex-col items-center mb-8">
            <div className="size-12 rounded-[14px] bg-accent flex items-center justify-center shadow-lg shadow-accent/30 mb-4">
              <span className="text-lg font-extrabold text-white tracking-tight">N</span>
            </div>
            <h1 className="text-xl font-bold text-ink-primary">نشرینو</h1>
            <p className="text-sm text-ink-tertiary mt-1">پلتفرم مدیریت محتوای شبکه‌های اجتماعی</p>
          </div>

          {/* بنر خطا */}
          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 bg-danger/8 text-danger border border-danger/20 rounded-xl p-3 text-sm mb-5"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          {/* عنوان فرم */}
          <div className="mb-5">
            <h2 className="text-lg font-bold text-ink-primary">ورود به نشرینو</h2>
            <p className="text-sm text-ink-tertiary mt-1 leading-relaxed">
              برای دسترسی به فضای کاری خود، اطلاعات حساب را وارد کنید.
            </p>
          </div>

          {/* فرم ورود */}
          <form
            action="/api/auth/callback/credentials"
            method="POST"
            className="space-y-4"
            onSubmit={() => setPending(true)}
          >
            <input type="hidden" name="csrfToken" value={csrfToken} />
            <input type="hidden" name="callbackUrl" value={callbackUrl || '/'} />

            {/* ایمیل */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-semibold text-ink-secondary">نشانی ایمیل</Label>
              <Input
                id="email"
                type="email"
                name="email"
                dir="ltr"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.ir"
                className="h-11 rounded-xl"
                autoComplete="email"
                autoFocus
              />
            </div>

            {/* رمز عبور با toggle نمایش */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-semibold text-ink-secondary">رمز عبور</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pe-10"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 start-0 min-w-[44px] flex items-center justify-center text-ink-tertiary hover:text-ink-secondary transition-colors"
                  aria-label={showPassword ? 'پنهان کردن رمز عبور' : 'نمایش رمز عبور'}
                >
                  {showPassword
                    ? <EyeOff className="size-4" />
                    : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {/* یادآوری و فراموشی */}
            <div className="flex items-center justify-between">
              <a
                href="#"
                className="min-h-[44px] inline-flex items-center text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
              >
                رمز عبور را فراموش کرده‌اید؟
              </a>
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="text-sm text-ink-secondary">مرا به خاطر بسپار</span>
                <input
                  type="checkbox"
                  name="remember"
                  className="size-[18px] rounded cursor-pointer"
                  style={{ accentColor: 'var(--color-accent)' }}
                />
              </label>
            </div>

            {/* دکمه اصلی */}
            <Button
              type="submit"
              disabled={!csrfToken || pending}
              className="h-12 w-full rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-base gap-2 shadow-sm shadow-accent/25 group active:scale-[0.98] transition-transform"
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <>
                  ورود به فضای کاری
                  <ArrowLeft className="size-4 transition-transform duration-200 group-hover:-translate-x-1" />
                </>
              )}
            </Button>
          </form>

          {/* دسترسی آزمایشی */}
          <div className="mt-5 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={fillDemo}
              className="w-full h-11 rounded-lg border border-border/70 bg-transparent hover:bg-surface text-xs text-ink-tertiary hover:text-ink-secondary transition-colors"
            >
              ورود با حساب آزمایشی
            </button>
          </div>

          {/* امنیت و لینک‌ها */}
          <div className="mt-5 flex flex-col items-center gap-3">
            <p className="flex items-center gap-1.5 text-xs text-ink-tertiary">
              <ShieldCheck className="size-3.5 text-success" />
              اتصال امن و رمزگذاری‌شده
            </p>
            <div className="flex items-center gap-3 text-xs text-ink-tertiary">
              <a href="#" className="min-h-[44px] inline-flex items-center hover:text-ink-secondary transition-colors">حریم خصوصی</a>
              <span>·</span>
              <a href="#" className="min-h-[44px] inline-flex items-center hover:text-ink-secondary transition-colors">شرایط استفاده</a>
              <span>·</span>
              <a href="#" className="min-h-[44px] inline-flex items-center hover:text-ink-secondary transition-colors">پشتیبانی</a>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Section 2: پیش‌نمایش محصول — ستون چپ ──────────── */}
      <section className="hidden lg:flex relative flex-col justify-center overflow-hidden border-e border-border/50 bg-surface/50 ambient-mesh">
        {/* بافت نقطه‌ای */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.06]"
          style={{
            backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 px-10 py-12 flex flex-col">
          {/* وضعیت سامانه */}
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: -8 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: ease.enter, delay: 0.05 }}
            className="self-start mb-6"
          >
            <Badge
              variant="outline"
              className="gap-1.5 text-xs font-medium px-3 py-1 rounded-full border-success/40 text-success bg-success/8"
            >
              <span className="size-1.5 rounded-full bg-success inline-block" />
              همه سرویس‌ها فعال هستند
            </Badge>
          </motion.div>

          {/* شعار اصلی — بدون ویرگول */}
          <motion.div
            initial={shouldAnimate ? { opacity: 0, y: 12 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: ease.enter, delay: 0.1 }}
          >
            <h2 className="text-4xl font-extrabold leading-tight text-ink-primary mb-3">
              مدیریت یکپارچه محتوا
              <br />
              <span className="bg-gradient-to-l from-accent to-violet-500 bg-clip-text text-transparent">
                از برنامه‌ریزی تا انتشار
              </span>
            </h2>
            <p className="text-sm text-ink-secondary leading-relaxed max-w-md">
              محتوا را برنامه‌ریزی، بازبینی و منتشر کنید و عملکرد همه شبکه‌ها را یکجا ببینید.
            </p>
          </motion.div>

          {/* کارت‌های محصول */}
          <DashboardMockup />
        </div>
      </section>

    </main>
  )
}
