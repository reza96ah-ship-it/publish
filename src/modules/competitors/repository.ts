/**
 * Issue #253: Competitor tracking — repository.
 *
 * Data-access layer. Competitor profiles are stored in-memory (per-process
 * Map). The benchmark + share-of-voice helpers query existing
 * PostMetricSnapshot + InboxMessage rows for the workspace side; the
 * competitor side returns zero placeholders (the app doesn't currently
 * ingest competitor analytics — those endpoints are stubs that document
 * the data the UI would need once a competitor-ingestion pipeline ships).
 *
 * db is imported ONLY here (architecture rule). The repository exposes
 * pure-data methods; the service adds validation + Persian error mapping.
 */

import { db } from '@/lib/db'

interface StoredCompetitor {
  id: string
  workspaceId: string
  name: string
  handle: string
  platform: string
  trackedMetrics: string[]
  createdAt: string
  updatedAt: string
}

const competitors = new Map<string, StoredCompetitor>()

export class CompetitorsRepository {
  list(workspaceId: string): StoredCompetitor[] {
    return Array.from(competitors.values())
      .filter((c) => c.workspaceId === workspaceId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  findByIdInWorkspace(id: string, workspaceId: string): StoredCompetitor | null {
    const c = competitors.get(id)
    return c && c.workspaceId === workspaceId ? c : null
  }

  create(data: StoredCompetitor): StoredCompetitor {
    competitors.set(data.id, data)
    return data
  }

  update(id: string, patch: Partial<StoredCompetitor>): StoredCompetitor | null {
    const existing = competitors.get(id)
    if (!existing) return null
    const updated = { ...existing, ...patch, id: existing.id, updatedAt: new Date().toISOString() }
    competitors.set(id, updated)
    return updated
  }

  delete(id: string): boolean {
    return competitors.delete(id)
  }

  /**
   * Sum workspace-side post-metric snapshots for the last `days` days.
   * Returns a map of metricType → summed value. The competitor side is
   * always 0 here (no ingestion pipeline yet) — the service surfaces this
   * honestly as "0 (داده رقیب در دسترس نیست)".
   */
  async getWorkspaceMetrics(workspaceId: string, days: number): Promise<Record<string, number>> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    const sinceStr = since.toISOString().slice(0, 10)
    const rows = await db.postMetricSnapshot.findMany({
      where: { workspaceId, date: { gte: sinceStr } },
      select: { metricType: true, value: true },
    })
    const totals: Record<string, number> = {}
    for (const r of rows) {
      totals[r.metricType] = (totals[r.metricType] ?? 0) + r.value
    }
    return totals
  }

  /**
   * Count workspace-side inbox messages for the last `days` days (a proxy
   * for "mentions" until a proper listening-pipeline count ships).
   */
  async getWorkspaceMentionCount(workspaceId: string, days: number): Promise<number> {
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    return db.inboxMessage.count({
      where: { workspaceId, messageType: 'mention', createdAt: { gte: since } },
    })
  }
}
