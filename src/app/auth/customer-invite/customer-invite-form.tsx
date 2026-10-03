'use client'

import { useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export function CustomerInviteForm() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const value = new URLSearchParams(window.location.hash.slice(1)).get('token') ?? ''
    setToken(value)
    window.history.replaceState(null, '', window.location.pathname)
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    if (password !== confirmPassword) {
      setError('تکرار رمز عبور مطابقت ندارد')
      setBusy(false)
      return
    }
    try {
      const response = await fetch('/api/auth/customer-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, email, name, password }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'ثبت‌نام انجام نشد')
      const signedIn = await signIn('credentials', { email, password, callbackUrl: '/channels', redirect: false })
      setPassword('')
      setConfirmPassword('')
      setToken('')
      if (!signedIn?.ok) {
        setError('حساب ساخته شد. لطفاً از صفحه ورود وارد شوید.')
        return
      }
      router.replace('/channels')
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ثبت‌نام انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main dir="rtl" className="min-h-dvh bg-canvas p-6 flex items-center justify-center">
      <div className="n-card w-full max-w-md p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-primary">ایجاد حساب مشتری</h1>
          <p className="mt-2 text-sm text-ink-secondary">این دعوت فقط یک‌بار قابل استفاده است و پس از ۷ روز منقضی می‌شود. ایمیل دعوت‌شده را وارد کنید.</p>
        </div>
        {!token ? <p role="alert" className="text-danger">لینک دعوت معتبر نیست. از دعوت‌کننده لینک جدید بگیرید.</p> : (
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm text-ink-primary">ایمیل دعوت‌شده
              <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
            </label>
            <label className="block text-sm text-ink-primary">نام شما
              <input required minLength={2} maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
            </label>
            <label className="block text-sm text-ink-primary">رمز عبور اپلیکیشن (حداقل ۱۲ نویسه)
              <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
            </label>
            <label className="block text-sm text-ink-primary">تکرار رمز عبور
              <input required type="password" minLength={12} maxLength={128} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
            </label>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <button disabled={busy} type="submit" className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'در حال ساخت حساب…' : 'ساخت حساب و ورود'}</button>
          </form>
        )}
        <p className="text-sm text-ink-secondary">قبلاً حساب دارید؟ <Link className="text-accent underline" href="/auth/signin">وارد شوید</Link></p>
      </div>
    </main>
  )
}
