import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { normalizeEmail } from '@/lib/invitations'
import { db } from '@/lib/db'
import { CustomerInviteIssuer } from './customer-invite-issuer'

export default async function CustomerInvitesPage() {
  const session = await getServerSession(authOptions)
  const ownerEmail = normalizeEmail(process.env.PLATFORM_OWNER_EMAIL ?? '')
  if (!ownerEmail || !session?.user || normalizeEmail(session.user.email ?? '') !== ownerEmail) redirect('/settings')
  const owner = await db.user.findUnique({ where: { id: session.user.id }, select: { email: true, mfaSecret: true, sessionVersion: true } })
  if (!owner || normalizeEmail(owner.email ?? '') !== ownerEmail) redirect('/settings')
  return <CustomerInviteIssuer initialMfaEnabled={Boolean(owner.mfaSecret)} passwordRotated={owner.sessionVersion > 0} />
}
