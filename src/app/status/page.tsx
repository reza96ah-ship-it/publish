/**
 * /status — public service status page.
 *
 * Shows overall system health and per-service component status.
 * Does not require authentication. Updates every 60s via client-side polling.
 */

import { Metadata } from 'next'
import { StatusPageClient } from './status-client'

export const metadata: Metadata = {
  title: 'وضعیت سرویس — نشرینو',
  description: 'وضعیت لحظه‌ای سرویس‌ها و APIهای نشرینو',
}

export default function StatusPage() {
  return <StatusPageClient />
}
