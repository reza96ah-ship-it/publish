import { redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SignInForm } from './signin-form'

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  // If already logged in, redirect to dashboard
  const session = await getServerSession(authOptions)
  if (session) redirect('/')

  const params = await searchParams

  return <SignInForm callbackUrl={params.callbackUrl || '/'} />
}
