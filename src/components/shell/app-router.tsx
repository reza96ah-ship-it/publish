"use client";

/**
 * AppRouter — client-side view switcher (SPA router).
 *
 * This is the interactive island that owns the `activeView` Zustand state
 * and renders the corresponding view component with a Framer Motion transition.
 *
 * Extracted from `src/app/page.tsx` so that page.tsx can be a Server Component
 * (which enables metadata exports, streaming, and future RSC adoption).
 */

import { AnimatePresence, motion } from "framer-motion";
import { useAppStore, type AppView } from "@/lib/store";
import { AppShell } from "@/components/shell/app-shell";
import { OperationalSummary } from "@/components/dashboard/operational-summary";
import { ExecutiveMetrics } from "@/components/dashboard/executive-metrics";
import { PublishingPulse } from "@/components/dashboard/publishing-pulse";
import { CampaignsPanel } from "@/components/dashboard/campaigns-panel";
import { PlatformsPanel } from "@/components/dashboard/platforms-panel";
import { ActionCenter } from "@/components/dashboard/action-center";
import { ComposeView } from "@/components/views/compose-view";
import { CalendarView } from "@/components/views/calendar-view";
import { CampaignsView } from "@/components/views/campaigns-view";
import { ContentView } from "@/components/views/content-view";
import { MediaView } from "@/components/views/media-view";
import { InboxView } from "@/components/views/inbox-view";
import { AnalyticsView } from "@/components/views/analytics-view";
import { ChannelsView } from "@/components/views/channels-view";
import { SettingsView } from "@/components/views/settings-view";

function DashboardView() {
  return (
    <div className="flex flex-col gap-4 md:gap-5 w-full">
      {/* Live operations summary */}
      <div className="order-1 lg:order-none">
        <OperationalSummary />
      </div>

      {/* Action Center - Mobile only, above pulse */}
      <div className="order-2 lg:hidden h-[400px]">
        <ActionCenter />
      </div>

      {/* Publishing Pulse + Action Center (Desktop) */}
      <div className="order-3 lg:order-none grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-8">
          <div className="h-[500px]">
            <PublishingPulse />
          </div>
        </div>
        <div className="hidden lg:block lg:col-span-4">
          <div className="h-[500px]">
            <ActionCenter />
          </div>
        </div>
      </div>

      {/* Executive metrics */}
      <div className="order-4 lg:order-none">
        <ExecutiveMetrics />
      </div>

      {/* Campaigns and Platforms */}
      <div className="order-5 lg:order-none grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-8">
          <div className="h-[460px]">
            <CampaignsPanel />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="h-[460px]">
            <PlatformsPanel />
          </div>
        </div>
      </div>
    </div>
  );
}

const viewComponents: Record<AppView, React.ComponentType> = {
  dashboard: DashboardView,
  compose: ComposeView,
  calendar: CalendarView,
  campaigns: CampaignsView,
  content: ContentView,
  media: MediaView,
  inbox: InboxView,
  analytics: AnalyticsView,
  channels: ChannelsView,
  settings: SettingsView,
};

export function AppRouter() {
  const activeView = useAppStore((s) => s.activeView);
  const ViewComponent = viewComponents[activeView] ?? DashboardView;

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeView}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
        >
          <ViewComponent />
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
