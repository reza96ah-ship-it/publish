import { redirect } from 'next/navigation'
import { requireWorkspace } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { isEnabled } from '@/lib/flags'
import { OnboardingWizard } from '@/components/onboarding/wizard'

export const metadata = { title: 'راه‌اندازی فضای کار — نشرینو' }

export default async function OnboardingPage() {
  const { workspace: ws0 } = await requireWorkspace()
  const workspaceId = ws0.id

  const [ws, flagOn] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        onboardingStep: true,
        onboardingCompleted: true,
        name: true,
        timezone: true,
        workWeek: true,
        platforms: { select: { id: true, type: true, status: true }, take: 5 },
      },
    }),
    isEnabled('guided_onboarding', workspaceId),
  ])

  // If already done or flag disabled, go to dashboard
  if (!flagOn || ws?.onboardingCompleted) redirect('/')

  return <OnboardingWizard initialStep={ws?.onboardingStep ?? 0} workspace={ws} />
}
