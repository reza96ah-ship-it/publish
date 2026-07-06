/**
 * Issue #253: Competitor tracking — types.
 *
 * A CompetitorProfile is a tracked rival brand on a single platform (e.g.
 * @rival_brand on Instagram). The benchmark + share-of-voice endpoints
 * aggregate existing analytics snapshots to compare the workspace's own
 * performance against competitors.
 *
 * Storage is in-memory (per-process Map). Competitor tracking is a
 * lightweight dashboard widget, not a customer-facing feature —
 * persistence is handled at the dashboard view layer via localStorage.
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

export interface CompetitorProfile {
  id: string
  workspaceId: string
  name: string
  handle: string
  platform: string
  trackedMetrics: string[]
  createdAt: string
  updatedAt: string
}

export interface BenchmarkResult {
  competitorId: string
  competitorName: string
  handle: string
  platform: string
  /** Aggregated metric values for the workspace vs competitor. */
  metrics: Array<{ key: string; workspace: number; competitor: number; deltaPct: number }>
  snapshotAt: string
}

export interface ShareOfVoice {
  /** Workspace + competitor totals over the comparison window. */
  totals: Array<{ name: string; handle: string; mentions: number; engagement: number; sharePct: number }>
  windowDays: number
  computedAt: string
}

// ── Service inputs ───────────────────────────────────────────────────────────

export interface CreateCompetitorInput {
  name: string
  handle: string
  platform: string
  trackedMetrics?: string[]
}

export type UpdateCompetitorInput = Partial<CreateCompetitorInput>

export interface BenchmarkQuery {
  /** Number of days to include in the benchmark window (default 30). */
  days?: number
}

export interface ShareOfVoiceQuery {
  days?: number
}
