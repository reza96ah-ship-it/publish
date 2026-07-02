/**
 * Analytics domain module — repository layer.
 * Prisma queries only; no business logic.
 */

import { db } from '@/lib/db'

export class AnalyticsRepository {
  async findSnapshots(
    workspaceId: string,
    platform: string | null | undefined,
    limit: number
  ) {
    return db.analyticsSnapshot.findMany({
      where: { workspaceId, platform: platform === 'all' ? null : (platform ?? null) },
      orderBy: { date: 'asc' },
      take: limit,
    })
  }

  async findRecentSnapshots(workspaceId: string, since: string) {
    return db.analyticsSnapshot.findMany({
      where: { workspaceId, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 50,
    })
  }

  async findConnectedPlatforms(workspaceId: string) {
    return db.platform.findMany({
      where: { workspaceId, tokenSecret: { not: null } },
      select: {
        id: true,
        type: true,
        targetId: true,
        tokenSecret: true,
      },
    })
  }
}
