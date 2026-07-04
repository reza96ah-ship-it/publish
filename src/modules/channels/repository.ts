/**
 * Channels domain module — repository layer.
 * Prisma queries only; no business logic.
 */

import { db } from '@/lib/db'
import type { PlatformRow } from './types'

const PLATFORM_SELECT = {
  id: true,
  workspaceId: true,
  name: true,
  type: true,
  status: true,
  circuitState: true,
  accountKind: true,
  username: true,
  primaryIssue: true,
  lastSuccessAt: true,
  tokenSecret: true,
  targetId: true,
  tokenExpiresAt: true,
  lastError: true,
  lastValidatedAt: true,
  createdAt: true,
} as const

export class ChannelsRepository {
  async listByWorkspace(
    workspaceId: string,
    cursor: string | undefined,
    limit: number
  ): Promise<PlatformRow[]> {
    return db.platform.findMany({
      where: { workspaceId, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
      select: PLATFORM_SELECT,
    })
  }

  async countByType(workspaceId: string): Promise<Map<string, number>> {
    const rows = await db.platform.groupBy({
      by: ['type'],
      where: { workspaceId },
      _count: { _all: true },
    })
    return new Map(rows.map((r) => [r.type, r._count._all]))
  }

  async findInWorkspace(id: string, workspaceId: string): Promise<PlatformRow | null> {
    return db.platform.findFirst({ where: { id, workspaceId }, select: PLATFORM_SELECT })
  }

  async update(id: string, data: Record<string, unknown>): Promise<PlatformRow> {
    return db.platform.update({ where: { id }, data, select: PLATFORM_SELECT })
  }
}
