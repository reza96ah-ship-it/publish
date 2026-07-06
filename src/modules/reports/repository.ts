/**
 * Issue #214: Exportable analytics reports — repository.
 *
 * Data-access layer. db is imported ONLY here (architecture rule).
 * Reuses the existing AnalyticsSnapshot table — same source the analytics
 * dashboard already queries — filtered by the report's date range + channels.
 */

import { db } from '@/lib/db'

export interface SnapshotRow {
  date: string
  platform: string | null
  metricType: string
  value: number
}

export class ReportsRepository {
  /** Fetch analytics snapshots for the report's date range + channels. */
  async findSnapshots(
    workspaceId: string,
    startDate: string,
    endDate: string,
    channels: string[]
  ): Promise<SnapshotRow[]> {
    // `channels` is the list of platform identifiers (instagram, telegram, …)
    // OR ['all'] — when 'all' is present we don't filter by platform.
    const platformFilter =
      channels.includes('all') || channels.length === 0
        ? undefined
        : { in: channels }
    const rows = await db.analyticsSnapshot.findMany({
      where: {
        workspaceId,
        date: { gte: startDate, lte: endDate },
        ...(platformFilter ? { platform: platformFilter } : {}),
      },
      orderBy: { date: 'asc' },
      take: 5000,
    })
    return rows.map((r) => ({
      date: r.date,
      platform: r.platform,
      metricType: r.metricType,
      value: r.value,
    }))
  }

  /** Fetch the workspace's name (for the report header). */
  async getWorkspaceName(workspaceId: string): Promise<string> {
    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    })
    return ws?.name ?? ''
  }
}
