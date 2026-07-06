/**
 * Issue #249: Versioned workflow builder — service.
 *
 * Business-logic layer. Follows the smart-pages/service.ts pattern:
 *   - Constructor injects the repository (default = new instance).
 *   - Cursor pagination handled in the service: repo returns `limit+1` rows,
 *     service slices + derives `nextCursor`.
 *   - Throws domain errors (AutomationError subclasses) — route handler maps
 *     them to HTTP via `instanceof AutomationError`.
 *
 * Versioning rule: any `updateAutomation` call that includes a `definition`
 * field bumps `version` by one and stashes the prior definition into
 * `previousDefinition` (so the UI can offer a one-click rollback). Pure
 * toggle calls (isActive / isPaused / killSwitch / dryRunMode) do NOT bump
 * the version — they are operational state, not definition changes.
 */

import { AutomationsRepository } from './repository'
import { AutomationNotFoundError, ValidationError } from './errors'
import type {
  AuthContext,
  AutomationItem,
  AutomationListQuery,
  AutomationListResult,
  AutomationRunItem,
  AutomationRunListQuery,
  AutomationRunListResult,
  CreateAutomationInput,
  UpdateAutomationInput,
  AutomationDefinition,
} from './types'

const DEFAULT_LIMIT = 20
const MAX_RUNS_PER_HOUR = 1000

export class AutomationsService {
  constructor(
    private readonly repo: AutomationsRepository = new AutomationsRepository()
  ) {}

  // ── List / Get ─────────────────────────────────────────────────────────────

  /** List automations for the active workspace, cursor-paginated. */
  async listAutomations(
    auth: AuthContext,
    query: AutomationListQuery
  ): Promise<AutomationListResult> {
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.list(auth.workspaceId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  /** Get a single automation. Verifies ownership. */
  async getAutomation(auth: AuthContext, id: string): Promise<AutomationItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    return existing
  }

  // ── Create / Update / Delete ───────────────────────────────────────────────

  /** Create a new automation. */
  async createAutomation(
    auth: AuthContext,
    input: CreateAutomationInput
  ): Promise<AutomationItem> {
    this.validateDefinition(input.definition)
    if (input.maxRunsPerHour !== undefined) {
      this.validateMaxRuns(input.maxRunsPerHour)
    }
    return this.repo.create(auth.workspaceId, auth.userId, input)
  }

  /**
   * Update an automation. If `definition` is present and differs from the
   * stored definition, the repository bumps `version` by one and stashes the
   * prior definition into `previousDefinition` (so the UI can offer a
   * one-click rollback). Toggle-only updates (no `definition` key) do not
   * bump the version — they are operational state, not definition changes.
   */
  async updateAutomation(
    auth: AuthContext,
    id: string,
    input: UpdateAutomationInput
  ): Promise<AutomationItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()

    if (input.definition !== undefined) {
      this.validateDefinition(input.definition)
    }
    if (input.maxRunsPerHour !== undefined) {
      this.validateMaxRuns(input.maxRunsPerHour)
    }

    return this.repo.updateWithVersion(id, existing, input)
  }

  /** Delete an automation. Verifies ownership first. */
  async deleteAutomation(auth: AuthContext, id: string): Promise<void> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    await this.repo.delete(id)
  }

  // ── Toggles ────────────────────────────────────────────────────────────────

  /** Toggle automation active state. */
  async toggleActive(auth: AuthContext, id: string, isActive: boolean): Promise<AutomationItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    return this.repo.update(id, { isActive })
  }

  /** Toggle automation paused state. */
  async togglePaused(auth: AuthContext, id: string, isPaused: boolean): Promise<AutomationItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    return this.repo.update(id, { isPaused })
  }

  /** Toggle automation dry-run mode. */
  async toggleDryRun(auth: AuthContext, id: string, dryRunMode: boolean): Promise<AutomationItem> {
    const existing = await this.repo.findByIdInWorkspace(id, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    return this.repo.update(id, { dryRunMode })
  }

  // ── Kill switch (workspace-wide) ──────────────────────────────────────────

  /**
   * Activate the kill switch across every automation in the workspace.
   * Returns the count of automations affected. Idempotent — calling when
   * already activated updates zero rows.
   */
  async activateKillSwitch(auth: AuthContext): Promise<{ count: number }> {
    const count = await this.repo.activateKillSwitch(auth.workspaceId)
    return { count }
  }

  /** Clear the kill switch across every automation in the workspace. */
  async deactivateKillSwitch(auth: AuthContext): Promise<{ count: number }> {
    const count = await this.repo.deactivateKillSwitch(auth.workspaceId)
    return { count }
  }

  // ── Run history ────────────────────────────────────────────────────────────

  /** List runs for an automation. Verifies automation ownership first. */
  async listRuns(
    auth: AuthContext,
    automationId: string,
    query: AutomationRunListQuery
  ): Promise<AutomationRunListResult> {
    const existing = await this.repo.findByIdInWorkspace(automationId, auth.workspaceId)
    if (!existing) throw new AutomationNotFoundError()
    const limit = query.limit ?? DEFAULT_LIMIT
    const rows = await this.repo.listRuns(automationId, auth.workspaceId, { ...query, limit })
    const hasMore = rows.length > limit
    const page = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? page[page.length - 1]?.id ?? null : null
    return { data: page, nextCursor }
  }

  /** Get a single run. Verifies workspace ownership. */
  async getRun(auth: AuthContext, runId: string): Promise<AutomationRunItem> {
    const run = await this.repo.findRunById(runId, auth.workspaceId)
    if (!run) throw new AutomationNotFoundError('اجرای اتوماسیون یافت نشد')
    return run
  }

  // ── Validation helpers ─────────────────────────────────────────────────────

  /** Ensure the definition has at least one trigger and one action. */
  private validateDefinition(def: AutomationDefinition): void {
    if (!def || typeof def !== 'object') {
      throw new ValidationError('ساختار اتوماسیون نامعتبر است')
    }
    if (!Array.isArray(def.triggers) || def.triggers.length === 0) {
      throw new ValidationError('حداقل یک راه‌انداز برای اتوماسیون الزامی است')
    }
    if (!Array.isArray(def.actions) || def.actions.length === 0) {
      throw new ValidationError('حداقل یک اقدام برای اتوماسیون الزامی است')
    }
    if (def.triggers.length > 20) {
      throw new ValidationError('حداکثر ۲۰ راه‌انداز مجاز است')
    }
    if (def.actions.length > 50) {
      throw new ValidationError('حداکثر ۵۰ اقدام مجاز است')
    }
  }

  /** Validate the per-hour rate limit. */
  private validateMaxRuns(max: number): void {
    if (!Number.isInteger(max) || max < 1 || max > MAX_RUNS_PER_HOUR) {
      throw new ValidationError(
        `حداکثر اجرا در ساعت باید عدد صحیح بین ۱ و ${MAX_RUNS_PER_HOUR} باشد`
      )
    }
  }
}

export const automationsService = new AutomationsService()
