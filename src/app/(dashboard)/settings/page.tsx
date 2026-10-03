import { SettingsView } from '@/components/views/settings-view'
import { getServerSession } from 'next-auth'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { normalizeEmail } from '@/lib/invitations'

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)
  const ownerEmail = normalizeEmail(process.env.PLATFORM_OWNER_EMAIL ?? '')
  const isOwner = Boolean(ownerEmail && session?.user && normalizeEmail(session.user.email ?? '') === ownerEmail)
  return <>
    <div dir="rtl" className="mx-auto max-w-6xl px-6 pt-6"><Link href="/settings/security" className="text-accent underline">امنیت حساب و تغییر رمز عبور</Link></div>
    {isOwner && <div dir="rtl" className="mx-auto max-w-6xl px-6 pt-6"><Link href="/settings/customer-invites" className="text-accent underline">دعوت مشتری جدید</Link></div>}
    <SettingsView />
  </>
}
