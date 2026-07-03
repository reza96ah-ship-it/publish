'use client'

/**
 * DashboardView — the default landing view at /
 * Shows: Operational Summary, Publishing Pulse, Action Center, Executive Metrics, Campaigns, Platforms
 */

import { OperationalSummary } from '@/components/dashboard/operational-summary'
import { ExecutiveMetrics } from '@/components/dashboard/executive-metrics'
import { PublishingPulse } from '@/components/dashboard/publishing-pulse'
import { CampaignsPanel } from '@/components/dashboard/campaigns-panel'
import { PlatformsPanel } from '@/components/dashboard/platforms-panel'
import { ActionCenter } from '@/components/dashboard/action-center'

export function DashboardView() {
  return (
    <div className="flex flex-col gap-4 md:gap-5 w-full">
      {/* Live operations summary */}
      <div className="order-1 lg:order-none">
        <OperationalSummary />
      </div>

      {/* Action Center - mobile only (hidden at md+, where it's in the grid) */}
      <div className="order-2 md:hidden h-[300px] sm:h-[360px]">
        <ActionCenter />
      </div>

      {/* Publishing Pulse + Action Center — 2-col at md, 8/4 at lg */}
      <div className="order-3 lg:order-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-8">
          <div className="h-[320px] sm:h-[420px] md:h-[460px] lg:h-[500px]">
            <PublishingPulse />
          </div>
        </div>
        <div className="hidden md:block lg:col-span-4">
          <div className="h-[460px] lg:h-[500px]">
            <ActionCenter />
          </div>
        </div>
      </div>

      {/* Executive metrics */}
      <div className="order-4 lg:order-none">
        <ExecutiveMetrics />
      </div>

      {/* Campaigns and Platforms */}
      <div className="order-5 lg:order-none grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-4 md:gap-5">
        <div className="lg:col-span-8">
          <div className="h-[320px] sm:h-[400px] md:h-[440px] lg:h-[460px]">
            <CampaignsPanel />
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="h-[320px] sm:h-[400px] md:h-[440px] lg:h-[460px]">
            <PlatformsPanel />
          </div>
        </div>
      </div>
    </div>
  )
}
