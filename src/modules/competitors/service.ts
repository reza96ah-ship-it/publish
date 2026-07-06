/**
 * Issue #253: Competitor tracking — service.
 *
 * Business-logic layer. Validates inputs, calls the repository for data,
 * and surfaces Persian errors via CompetitorError subclasses. The
 * benchmark + share-of-voice helpers aggregate workspace-side metrics;
 * competitor-side numbers are zero until an ingestion pipeline ships
 * (the UI surfaces this honestly — no fake data).
 */

import { randomUUID } from 'crypto'
import { CompetitorsRepository } from './repository'
import {
  CompetitorNotFoundError,
  ValidationError,
} from './errors'
import type {
  AuthContext,
  CompetitorProfile,
  CreateCompetitorInput,
  UpdateCompetitorInput,
  BenchmarkResult,
  BenchmarkQuery,
  ShareOfVoice,
  ShareOfVoiceQuery,
} from './types'

const DEFAULT_WINDOW_DAYS = 30

export class CompetitorsService {
  constructor(private readonly repo: CompetitorsRepository = new CompetitorsRepository()) {}

  listCompetitors(auth: AuthContext): CompetitorProfile[] {
    return this.repo.list(auth.workspaceId)
  }

  getCompetitor(auth: AuthContext, id: string): CompetitorProfile {
    const c = this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!c) throw new CompetitorNotFoundError()
    return c
  }

  createCompetitor(auth: AuthContext, input: CreateCompetitorInput): CompetitorProfile {
    if (!input.name || input.name.trim().length === 0) {
      throw new ValidationError('نام رقیب الزامی است')
    }
    if (!input.handle || input.handle.trim().length === 0) {
      throw new ValidationError('شناسه رقیب الزامی است')
    }
    // Workspace-level (handle, platform) uniqueness check.
    const existing = this.repo.list(auth.workspaceId)
    if (existing.some((c) => c.handle === input.handle && c.platform === input.platform)) {
      throw new ValidationError('این رقیب قبلاً ثبت شده است')
    }
    const now = new Date().toISOString()
    return this.repo.create({
      id: `comp-${randomUUID().slice(0, 12)}`,
      workspaceId: auth.workspaceId,
      name: input.name.trim(),
      handle: input.handle.trim(),
      platform: input.platform,
      trackedMetrics: input.trackedMetrics ?? [],
      createdAt: now,
      updatedAt: now,
    })
  }

  updateCompetitor(
    auth: AuthContext,
    id: string,
    input: UpdateCompetitorInput
  ): CompetitorProfile {
    const existing = this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CompetitorNotFoundError()
    const patch: Partial<CompetitorProfile> = {}
    if (input.name !== undefined) patch.name = input.name.trim()
    if (input.handle !== undefined) patch.handle = input.handle.trim()
    if (input.platform !== undefined) patch.platform = input.platform
    if (input.trackedMetrics !== undefined) patch.trackedMetrics = input.trackedMetrics
    const updated = this.repo.update(id, patch)
    if (!updated) throw new CompetitorNotFoundError()
    return updated
  }

  deleteCompetitor(auth: AuthContext, id: string): void {
    const existing = this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new CompetitorNotFoundError()
    this.repo.delete(id)
  }

  /**
   * Benchmark the workspace's own metrics over the last N days vs each
   * competitor. Competitor-side numbers are 0 until an ingestion pipeline
   * ships; the UI shows the workspace value + an honest "داده رقیب در دسترس
   * نیست" badge next to the zero.
   */
  async getBenchmark(
    auth: AuthContext,
    query: BenchmarkQuery = {}
  ): Promise<BenchmarkResult[]> {
    const days = query.days ?? DEFAULT_WINDOW_DAYS
    const workspaceMetrics = await this.repo.getWorkspaceMetrics(auth.workspaceId, days)
    const competitors = this.repo.list(auth.workspaceId)
    const snapshotAt = new Date().toISOString()
    return competitors.map((c) => ({
      competitorId: c.id,
      competitorName: c.name,
      handle: c.handle,
      platform: c.platform,
      metrics: Object.entries(workspaceMetrics).map(([key, wsValue]) => ({
        key,
        workspace: wsValue,
        competitor: 0, // no ingestion pipeline yet
        deltaPct: 0, // undefined-vs-zero — UI surfaces "نامشخص"
      })),
      snapshotAt,
    }))
  }

  /**
   * Share-of-voice over the last N days. Workspace side gets real mention +
   * engagement counts; competitor side is 0 (no ingestion). The UI sums to
   * 100% across only entries with non-zero totals — competitors with 0 are
   * surfaced as "در دسترس نیست".
   */
  async getShareOfVoice(
    auth: AuthContext,
    query: ShareOfVoiceQuery = {}
  ): Promise<ShareOfVoice> {
    const days = query.days ?? DEFAULT_WINDOW_DAYS
    const [workspaceMentions, workspaceMetrics] = await Promise.all([
      this.repo.getWorkspaceMentionCount(auth.workspaceId, days),
      this.repo.getWorkspaceMetrics(auth.workspaceId, days),
    ])
    const workspaceEngagement = workspaceMetrics['engagement'] ?? 0
    const competitors = this.repo.list(auth.workspaceId)
    const totals = [
      {
        name: 'فضای کار شما',
        handle: '',
        mentions: workspaceMentions,
        engagement: workspaceEngagement,
        sharePct: 100, // only entry with non-zero totals — full share
      },
      ...competitors.map((c) => ({
        name: c.name,
        handle: c.handle,
        mentions: 0,
        engagement: 0,
        sharePct: 0,
      })),
    ]
    return {
      totals,
      windowDays: days,
      computedAt: new Date().toISOString(),
    }
  }
}

export const competitorsService = new CompetitorsService()
