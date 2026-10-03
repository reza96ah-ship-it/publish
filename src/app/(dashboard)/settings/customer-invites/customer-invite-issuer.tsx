'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

type PendingInvite = { id: string; emailNormalized: string; expiresAt: string; workspace: { name: string } }

export function CustomerInviteIssuer({ initialMfaEnabled }: { initialMfaEnabled: boolean }) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled)
  const [mfaSetup, setMfaSetup] = useState<{ qrDataUrl: string; secret: string } | null>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [workspaceName, setWorkspaceName] = useState('')
  const [inviteUrl, setInviteUrl] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [pending, setPending] = useState<PendingInvite[]>([])

  async function refreshPending() {
    const response = await fetch('/api/auth/customer-invites', { cache: 'no-store' })
    if (response.ok) setPending((await response.json()).invitations)
  }

  useEffect(() => { if (mfaEnabled) void refreshPending() }, [mfaEnabled])

  async function startMfa() {
    setError('')
    const response = await fetch('/api/auth/mfa/setup', { method: 'POST' })
    const body = await response.json()
    if (!response.ok) { setError(body.error || 'شروع ورود دومرحله‌ای ناموفق بود'); return }
    setMfaSetup({ qrDataUrl: body.qrDataUrl, secret: body.secret })
  }

  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    const response = await fetch('/api/auth/mfa/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: mfaCode }),
    })
    const body = await response.json()
    if (!response.ok) { setError(body.error || 'کد معتبر نیست'); return }
    setBackupCodes(body.backupCodes)
    setMfaSetup(null)
    setMfaCode('')
    setMfaEnabled(true)
  }

  async function issue(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setInviteUrl('')
    try {
      const response = await fetch('/api/auth/customer-invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, workspaceName }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || 'صدور دعوت‌نامه ناموفق بود')
      setInviteUrl(body.inviteUrl)
      await refreshPending()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'صدور دعوت‌نامه ناموفق بود')
    } finally {
      setBusy(false)
    }
  }

  async function revoke(invitationId: string) {
    setError('')
    const response = await fetch('/api/auth/customer-invites', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invitationId }),
    })
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setError(body.error || 'لغو دعوت‌نامه ناموفق بود')
      return
    }
    setInviteUrl('')
    await refreshPending()
  }

  return (
    <main dir="rtl" className="mx-auto max-w-xl p-6 space-y-5">
      <h1 className="text-2xl font-bold">دعوت مشتری جدید</h1>
      <p className="text-sm text-ink-secondary">برای هر مشتری یک فضای کاری مستقل ساخته می‌شود. لینک را فقط از کانال خصوصی به همان مشتری بفرستید. مشتری رمز اپلیکیشن را خودش تعیین می‌کند؛ هرگز رمز اینستاگرام او را نخواهید.</p>
      {!mfaEnabled && <section className="n-card p-5 space-y-4">
        <h2 className="font-semibold">ابتدا ورود دومرحله‌ای را فعال کنید</h2>
        <p className="text-sm text-ink-secondary">پس از فعال‌سازی، ورود بعدی شما به کد برنامه احراز هویت یا کد پشتیبان نیاز دارد.</p>
        {!mfaSetup && <button type="button" onClick={() => void startMfa()} className="rounded-lg bg-accent px-4 py-2 text-white">دریافت کد QR</button>}
        {mfaSetup && <form onSubmit={verifyMfa} className="space-y-3">
          <Image unoptimized src={mfaSetup.qrDataUrl} alt="کد QR ورود دومرحله‌ای" width={180} height={180} />
          <p className="text-sm">اگر QR قابل اسکن نیست، این کلید را در برنامه احراز هویت وارد کنید:</p>
          <code dir="ltr" className="block break-all rounded-lg bg-canvas p-2 text-sm">{mfaSetup.secret}</code>
          <label className="block text-sm">کد ۶ رقمی برنامه
            <input required inputMode="numeric" autoComplete="one-time-code" value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
          </label>
          <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white">تأیید و فعال‌سازی</button>
        </form>}
      </section>}
      {backupCodes.length > 0 && <section className="n-card p-5 space-y-3" role="alert">
        <h2 className="font-semibold">کدهای پشتیبان را اکنون ذخیره کنید</h2>
        <p className="text-sm text-ink-secondary">این کدها فقط همین یک‌بار نمایش داده می‌شوند. آن‌ها را در محل امن نگه دارید و با کسی به اشتراک نگذارید.</p>
        <code dir="ltr" className="block whitespace-pre-wrap rounded-lg bg-canvas p-3 text-sm">{backupCodes.join('\n')}</code>
        <button type="button" onClick={() => setBackupCodes([])} className="rounded-lg border border-border px-4 py-2">ذخیره کردم</button>
      </section>}
      {error && <p role="alert" className="text-danger">{error}</p>}
      {mfaEnabled && <>
      <form onSubmit={issue} className="n-card p-5 space-y-4">
        <label className="block text-sm">نام فضای کاری
          <input required minLength={2} maxLength={80} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
        </label>
        <label className="block text-sm">ایمیل مشتری
          <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1 w-full rounded-lg border border-border bg-surface p-3" />
        </label>
        <button disabled={busy} type="submit" className="rounded-lg bg-accent px-4 py-2 text-white disabled:opacity-50">{busy ? 'در حال ساخت…' : 'ساخت دعوت‌نامه'}</button>
      </form>
      {inviteUrl && <div className="n-card p-5 space-y-2">
        <p className="font-semibold">لینک یک‌بار نمایش داده می‌شود (اعتبار: ۷ روز)</p>
        <input aria-label="لینک دعوت" readOnly value={inviteUrl} className="w-full rounded-lg border border-border bg-surface p-3 text-left text-sm" dir="ltr" onFocus={(event) => event.target.select()} />
        <p className="text-sm text-ink-secondary">لینک را اکنون کپی و خصوصی ارسال کنید. صفحه را برای جلوگیری از افشای لینک ببندید.</p>
      </div>}
      <section className="n-card p-5 space-y-3">
        <h2 className="font-semibold">دعوت‌نامه‌های در انتظار</h2>
        {pending.length === 0 && <p className="text-sm text-ink-secondary">دعوت‌نامه فعالی وجود ندارد.</p>}
        {pending.map((invitation) => <div key={invitation.id} className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
          <div><p className="font-medium">{invitation.workspace.name}</p><p dir="ltr" className="text-ink-secondary">{invitation.emailNormalized}</p><p className="text-ink-secondary">انقضا: {new Date(invitation.expiresAt).toLocaleDateString('fa-IR')}</p></div>
          <button type="button" onClick={() => void revoke(invitation.id)} className="rounded-lg border border-danger px-3 py-2 text-danger">لغو</button>
        </div>)}
      </section>
      </>}
    </main>
  )
}
