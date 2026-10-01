'use client'

import { useState } from 'react'
import Link from 'next/link'

export function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [totpCode, setTotpCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (newPassword !== confirmPassword) {
      setError('تکرار رمز عبور مطابقت ندارد')
      return
    }
    setBusy(true)
    try {
      const response = await fetch('/api/auth/password/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, totpCode }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'تغییر رمز عبور انجام نشد')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setTotpCode('')
      setMessage('رمز عبور اپلیکیشن تغییر کرد. آن را در محل امن ذخیره کنید.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تغییر رمز عبور انجام نشد')
    } finally {
      setBusy(false)
    }
  }

  return <main dir="rtl" className="mx-auto max-w-xl space-y-5 p-6">
    <Link href="/settings" className="text-sm text-accent underline">بازگشت به تنظیمات</Link>
    <h1 className="text-2xl font-bold">امنیت حساب</h1>
    <p className="text-sm text-ink-secondary">اگر از رمز آزمایشی استفاده می‌کنید، پیش از دعوت مشتری آن را تغییر دهید. این رمز برای ورود به اپلیکیشن است، نه اینستاگرام.</p>
    <form onSubmit={submit} className="n-card space-y-4 p-5">
      <label className="block text-sm">رمز عبور فعلی
        <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
      </label>
      <label className="block text-sm">رمز عبور جدید (حداقل ۱۲ نویسه)
        <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
      </label>
      <label className="block text-sm">تکرار رمز جدید
        <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
      </label>
      <label className="block text-sm">کد برنامه احراز هویت (اگر فعال است)
        <input type="text" inputMode="numeric" autoComplete="one-time-code" value={totpCode} onChange={(event) => setTotpCode(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
      </label>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {message && <p role="status" className="text-sm text-success">{message}</p>}
      <button disabled={busy} type="submit" className="rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-50">{busy ? 'در حال تغییر…' : 'تغییر رمز عبور'}</button>
    </form>
  </main>
}
