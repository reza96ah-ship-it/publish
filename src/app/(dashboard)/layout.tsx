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
 */

import { AppShell } from '@/components/shell/app-shell'
import { WebVitals } from '@/components/providers/web-vitals'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <WebVitals />
      {children}
    </AppShell>
  )
}
