/**
 * (dashboard) layout — AppShell persists across all view routes.
 *
 * This is a route group layout: the (dashboard) parentheses mean the group
 * doesn't appear in the URL. So /compose, /calendar, etc. all share this
 * layout without /dashboard/ in the URL path.
 *
 * AppShell (Sidebar, CommandBar, CommandPalette, etc.) lives here so it
 * does NOT remount when navigating between views — only the page content
 * changes. This gives us instant view transitions with no layout flash.
 *
 * Issue #244: if the guided_onboarding feature flag is enabled for this
 * workspace and onboarding is not yet complete, redirect to /onboarding.
 */

import { redirect } from 'next/navigation'
import { AppShell } from '@/components/shell/app-shell'
import { WebVitals } from '@/components/providers/web-vitals'
import { requireWorkspace } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { isEnabled } from '@/lib/flags'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { workspace } = await requireWorkspace()
  const workspaceId = workspace.id

  const [ws, flagOn] = await Promise.all([
    db.workspace.findUnique({
      where: { id: workspaceId },
      select: { onboardingCompleted: true },
    }),
    isEnabled('guided_onboarding', workspaceId),
  ])

  if (flagOn && ws && !ws.onboardingCompleted) {
    redirect('/onboarding')
  }

  return (
    <AppShell>
      <WebVitals />
      {children}
    </AppShell>
  )
}
