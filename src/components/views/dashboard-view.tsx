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
  )
}
