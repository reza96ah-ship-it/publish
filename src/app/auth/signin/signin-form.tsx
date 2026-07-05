'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Coffee, Mail, Lock, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { ease } from '@/lib/motion'

interface SignInFormProps {
  callbackUrl: string
  error?: string
}

/** Map next-auth error codes to Persian user-facing messages. */
function mapAuthError(code?: string): string | null {
  if (!code) return null
  switch (code) {
    case 'CredentialsSignin':
      return 'ایمیل یا رمز عبور اشتباه است'
    case 'Callback':
      return 'خطا در ورود — لطفاً دوباره تلاش کنید'
    case 'Configuration':
      return 'خطای پیکربندی سرور'
    case 'AccessDenied':
      return 'دسترسی رد شد'
    default:
      return 'خطا در ورود'
  }
}

export function SignInForm({ error }: SignInFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [csrfToken, setCsrfToken] = useState('')
  // Derive the error message directly from the prop (P1-18). Reading the
  // next-auth ?error= param server-side and passing it down avoids both
  // useSearchParams + a Suspense boundary and a setState-in-effect cascade.
  const errorMessage = mapAuthError(error)

  // Fetch CSRF token CLIENT-SIDE — this sets the next-auth.csrf-token COOKIE
  // on the user's browser. The server-side getCsrfToken() does NOT set the
  // cookie on the browser (it sets it on the server's HTTP client), which
  // causes CSRF validation to fail on form POST.
  useEffect(() => {
    fetch('/api/auth/csrf')
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken))
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 sm:p-6 bg-canvas">
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: ease.enter }}
        className="w-full max-w-[400px]"
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex size-14 items-center justify-center rounded-xl bg-accent shadow-lg shadow-accent/20 mb-4">
            <Coffee className="size-7 text-white" strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-ink-primary tracking-tight">نشرینو</h1>
          <p className="text-sm text-ink-tertiary mt-1">استودیوی عملیات شبکه‌های اجتماعی</p>
        </div>

        {/* Native form POST — browser handles cookies + redirect natively */}
        <div className="n-card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-ink-primary mb-1">ورود به حساب</h2>
          <p className="text-xs text-ink-tertiary mb-5">
            برای ادامه وارد حساب کاربری خود شوید
          </p>

          {errorMessage && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-start gap-2 bg-danger-soft text-danger border border-danger/20 rounded-lg p-3 text-sm mb-4"
            >
              <AlertCircle className="size-4 shrink-0 mt-0.5" strokeWidth={2} />
              <span className="leading-snug">{errorMessage}</span>
            </div>
          )}

          <form action="/api/auth/callback/credentials" method="POST" className="space-y-4">
            {/* Client-fetched CSRF token (cookie is set on browser) */}
            <input type="hidden" name="csrfToken" value={csrfToken} />
            {/* Relative callback URL */}
            <input type="hidden" name="callbackUrl" value="/" />

            {/* Email */}
            <div>
              <label className="text-sm font-semibold text-ink-secondary mb-1.5 block">
                ایمیل
              </label>
              <div className="relative">
                <Mail className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  dir="ltr"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="n-control w-full h-10 ps-10 pe-3 text-sm text-ink-primary placeholder:text-ink-tertiary"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-sm font-semibold text-ink-secondary mb-1.5 block">
                رمز عبور
              </label>
              <div className="relative">
                <Lock className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-ink-tertiary pointer-events-none" />
                <input
                  type="password"
                  name="password"
                  dir="ltr"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="n-control w-full h-10 ps-10 pe-3 text-sm text-ink-primary placeholder:text-ink-tertiary"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {/* Submit — disabled until CSRF token loads (prevents race condition) */}
            <button
              type="submit"
              disabled={!csrfToken}
              aria-label="ورود"
              aria-busy={!csrfToken}
              className="n-focus-ring w-full h-10 rounded-lg bg-accent text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50 flex items-center justify-center gap-2 dark:text-canvas"
            >
              {!csrfToken ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2.5} />
              ) : (
                <>
                  ورود
                  <ArrowLeft className="size-4" strokeWidth={2.5} />
                </>
              )}
            </button>
          </form>

          {/* Demo credentials hint */}
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs text-ink-tertiary text-center">
              دمو:{' '}
              <span className="num-tabular font-semibold" dir="ltr">
                demo@nashrino.ir
              </span>{' '}
              /{' '}
              <span className="num-tabular font-semibold" dir="ltr">
                demo1234
              </span>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-ink-tertiary mt-6">
          نشرینو © ۱۴۰۴ — سامانه مدیریت انتشار شبکه‌های اجتماعی
        </p>
      </motion.div>
    </div>
  )
}
