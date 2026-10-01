import { CustomerInviteForm } from './customer-invite-form'

export const metadata = { referrer: 'no-referrer' as const, title: 'پذیرش دعوت مشتری' }

export default function CustomerInvitePage() {
  return <CustomerInviteForm />
}
