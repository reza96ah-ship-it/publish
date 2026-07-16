'use client'

/**
 * DashboardView — the default landing view at /  (plan §2).
 *
 * Structure: header + global filters → status strip → four KPIs →
 * performance chart (8 col) + action panel (4 col) → publishing table →
 * campaign health + account health. No fixed panel heights, no inner
 * scroll. Below-fold panels are lazy-loaded (plan §14).
 *
 * Mobile order (plan §5): header/filters → KPIs → actions → chart →
 * queue cards → campaigns → accounts.
 */

import { Suspense } from 'react'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import { listContainer, listItem } from '@/lib/motion'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { OperationalSummary } from '@/components/dashboard/operational-summary'
import { ExecutiveMetrics } from '@/components/dashboard/executive-metrics'
import { PerformanceChart } from '@/components/dashboard/performance-chart'
import { ActionCenter } from '@/components/dashboard/action-center'
import { SkeletonCard } from '@/components/dashboard/shared'

// Below-fold panels: deferred chunks with layout-matched skeletons (plan §14).
const PublishingTable = dynamic(
  () => import('@/components/dashboard/publishing-table').then((m) => m.PublishingTable),
  { loading: () => <SkeletonCard /> }
)
const CampaignsPanel = dynamic(
  () => import('@/components/dashboard/campaigns-panel').then((m) => m.CampaignsPanel),
  { loading: () => <SkeletonCard /> }
)
const PlatformsPanel = dynamic(
  () => import('@/components/dashboard/platforms-panel').then((m) => m.PlatformsPanel),
  { loading: () => <SkeletonCard /> }
)

export function DashboardView() {
  return (
    <motion.div
      variants={listContainer}
      initial="hidden"
      animate="visible"
      className="flex flex-col gap-4 md:gap-5 w-full"
    >
      {/* useSearchParams (filters) requires a Suspense boundary at prerender */}
      <Suspense fallback={<SkeletonCard />}>
        {/* A — header: context, global filters, primary CTA */}
        <motion.div variants={listItem}>
          <DashboardHeader />
        </motion.div>

        {/* Status strip — وضعیت امروز */}
        <motion.div variants={listItem} className="hidden md:block">
          <OperationalSummary />
        </motion.div>

        {/* B — four strategic KPIs (2-col on mobile) */}
        <motion.div variants={listItem}>
          <ExecutiveMetrics />
        </motion.div>

        {/* C — action panel first on mobile, chart 8/4 split at lg */}
        <motion.div
          variants={listItem}
          className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5"
        >
          <div className="order-1 lg:order-2 lg:col-span-4">
            <ActionCenter />
          </div>
          <div className="order-2 lg:order-1 lg:col-span-8">
            <PerformanceChart />
          </div>
        </motion.div>

        {/* Status strip on mobile — after the fold-critical sections */}
        <motion.div variants={listItem} className="md:hidden">
          <OperationalSummary />
        </motion.div>

        {/* D — publishing queue, full width */}
        <motion.div variants={listItem}>
          <PublishingTable />
        </motion.div>

        {/* E — campaign health + account connections */}
        <motion.div
          variants={listItem}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5"
        >
          <CampaignsPanel />
          <PlatformsPanel />
        </motion.div>
      </Suspense>
    </motion.div>
  )
}
