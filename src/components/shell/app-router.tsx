"use client";

/**
 * AppRouter — client-side view switcher using URL search params.
 *
 * Sprint A: Replaced Zustand activeView with useViewRoute() hook.
 * Views are now at /?view=<name> — shareable, bookmarkable, back/forward.
 *
 * P10-7: Uses React.lazy + Suspense for route-level code splitting.
 */

import { lazy, Suspense } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useViewRoute } from "@/lib/view-route";
import { AppShell } from "@/components/shell/app-shell";
import { OperationalSummary } from "@/components/dashboard/operational-summary";
import { ExecutiveMetrics } from "@/components/dashboard/executive-metrics";
import { PublishingPulse } from "@/components/dashboard/publishing-pulse";
import { CampaignsPanel } from "@/components/dashboard/campaigns-panel";
import { PlatformsPanel } from "@/components/dashboard/platforms-panel";
import { ActionCenter } from "@/components/dashboard/action-center";

// P10-7: Lazy-load heavy views for smaller initial bundle
const ComposeView = lazy(() => import("@/components/views/compose-view").then(m => ({ default: m.ComposeView })));
const CalendarView = lazy(() => import("@/components/views/calendar-view").then(m => ({ default: m.CalendarView })));
const CampaignsView = lazy(() => import("@/components/views/campaigns-view").then(m => ({ default: m.CampaignsView })));
const ContentView = lazy(() => import("@/components/views/content-view").then(m => ({ default: m.ContentView })));
const MediaView = lazy(() => import("@/components/views/media-view").then(m => ({ default: m.MediaView })));
const InboxView = lazy(() => import("@/components/views/inbox-view").then(m => ({ default: m.InboxView })));
const AnalyticsView = lazy(() => import("@/components/views/analytics-view").then(m => ({ default: m.AnalyticsView })));
const ChannelsView = lazy(() => import("@/components/views/channels-view").then(m => ({ default: m.ChannelsView })));
const SettingsView = lazy(() => import("@/components/views/settings-view").then(m => ({ default: m.SettingsView })));

function DashboardView() {
  return (
    <div className="flex flex-col gap-4 md:gap-5 w-full">
      <div className="order-1 lg:order-none">
        <OperationalSummary />
      </div>
      <div className="order-2 lg:hidden h-[400px]">
        <ActionCenter />
      </div>
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
      <div className="order-4 lg:order-none">
        <ExecutiveMetrics />
      </div>
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

const viewComponents: Record<string, React.ComponentType> = {
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

function ViewSkeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-pulse text-[12px] text-ink-tertiary">در حال بارگذاری…</div>
    </div>
  );
}

export function AppRouter() {
  const { view } = useViewRoute();
  const ViewComponent = viewComponents[view] ?? DashboardView;

  return (
    <AppShell>
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0, 0, 0.2, 1] }}
        >
          <Suspense fallback={<ViewSkeleton />}>
            <ViewComponent />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </AppShell>
  );
}
