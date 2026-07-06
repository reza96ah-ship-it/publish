/**
 * Issue #249: Versioned workflow builder — repository.
 *
 * Data-access layer. The ONLY file in this module that imports `db`.
 * Follows the smart-pages/repository.ts pattern (cursor-paginated list, simple
 * transaction-free writes, ownership check at the service layer).
 */

import { db } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import type {
  AutomationItem,
  AutomationRunItem,
  AutomationListQuery,
  AutomationRunListQuery,
  CreateAutomationInput,
  UpdateAutomationInput,
  AutomationDefinition,
} from './types'

// ── Row → Item mappers ───────────────────────────────────────────────────────
//
// Prisma returns JSON columns as `Prisma.JsonValue`; at runtime they're the
// shapes we stored. We coerce to the typed structures the rest of the app uses.

function toDefinition(value: Prisma.JsonValue): AutomationDefinition {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { triggers: [], conditions: [], actions: [] }
  }
  const obj = value as Record<string, unknown>
  return {
    triggers: Array.isArray(obj.triggers) ? (obj.triggers as AutomationDefinition['triggers']) : [],
    conditions: Array.isArray(obj.conditions) ? (obj.conditions as AutomationDefinition['conditions']) : [],
    actions: Array.isArray(obj.actions) ? (obj.actions as AutomationDefinition['actions']) : [],
  }
}

function toAutomationItem(row: {
  id: string
  workspaceId: string
  name: string
  description: string | null
  version: number
  definition: Prisma.JsonValue
  previousDefinition: Prisma.JsonValue | null
  isActive: boolean
  isPaused: boolean
  dryRunMode: boolean
  killSwitch: boolean
  maxRunsPerHour: number
  requireApproval: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
}): AutomationItem {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    version: row.version,
    definition: toDefinition(row.definition),
    previousDefinition: row.previousDefinition ? toDefinition(row.previousDefinition) : null,
    isActive: row.isActive,
    isPaused: row.isPaused,
    dryRunMode: row.dryRunMode,
    killSwitch: row.killSwitch,
    maxRunsPerHour: row.maxRunsPerHour,
    requireApproval: row.requireApproval,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function toRunItem(row: {
  id: string
  automationId: string
  version: number
  trigger: Prisma.JsonValue
  conditions: Prisma.JsonValue
  actions: Prisma.JsonValue
  status: string
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}): AutomationRunItem {
  const asRecord = (v: Prisma.JsonValue): Record<string, unknown> =>
    typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {}
  return {
    id: row.id,
    automationId: row.automationId,
    version: row.version,
    trigger: asRecord(row.trigger),
    conditions: asRecord(row.conditions),
    actions: asRecord(row.actions),
    status: row.status,
    error: row.error,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
  }
}

export class AutomationsRepository {
  /** List automations in a workspace, cursor-paginated by createdAt desc. */
  async list(workspaceId: string, query: AutomationListQuery): Promise<AutomationItem[]> {
    const limit = query.limit ?? 20
    const rows = await db.automation.findMany({
      where: {
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return rows.map(toAutomationItem)
  }

  /** Find a single automation within a workspace (ownership check). */
  async findByIdInWorkspace(id: string, workspaceId: string): Promise<AutomationItem | null> {
    const row = await db.automation.findFirst({ where: { id, workspaceId } })
    return row ? toAutomationItem(row) : null
  }

  /** Create a new automation. */
  async create(
    workspaceId: string,
    createdById: string,
    data: CreateAutomationInput
  ): Promise<AutomationItem> {
    const row = await db.automation.create({
      data: {
        workspaceId,
        name: data.name,
        description: data.description ?? null,
        definition: data.definition as unknown as Prisma.InputJsonValue,
        dryRunMode: data.dryRunMode ?? false,
        maxRunsPerHour: data.maxRunsPerHour ?? 10,
        requireApproval: data.requireApproval ?? false,
        createdById,
      },
    })
    return toAutomationItem(row)
  }

  /**
   * Update an automation. Caller MUST have verified ownership first.
   * If `definition` is being changed, the service pre-bumps `version` and
   * stashes the prior definition into `previousDefinition` — both are passed
   * in via `data` so this method stays a thin update.
   */
  async update(id: string, data: UpdateAutomationInput): Promise<AutomationItem> {
    const row = await db.automation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.definition !== undefined
          ? { definition: data.definition as unknown as Prisma.InputJsonValue }
          : {}),
        ...(data.dryRunMode !== undefined ? { dryRunMode: data.dryRunMode } : {}),
        ...(data.maxRunsPerHour !== undefined ? { maxRunsPerHour: data.maxRunsPerHour } : {}),
        ...(data.requireApproval !== undefined ? { requireApproval: data.requireApproval } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.isPaused !== undefined ? { isPaused: data.isPaused } : {}),
        ...(data.killSwitch !== undefined ? { killSwitch: data.killSwitch } : {}),
      },
    })
    return toAutomationItem(row)
  }

  /** Delete an automation. Caller MUST have verified ownership first. */
  async delete(id: string): Promise<void> {
    await db.automation.delete({ where: { id } })
  }

  /**
   * Update with version bump + previousDefinition snapshot. Called by the
   * service when `definition` is being changed. If the patch includes a
   * `definition`, version is incremented by 1 and the existing definition is
   * copied into `previousDefinition` before the new definition is written.
   */
  async updateWithVersion(
    id: string,
    existing: AutomationItem,
    patch: UpdateAutomationInput
  ): Promise<AutomationItem> {
    const hasDefinitionChange =
      patch.definition !== undefined &&
      JSON.stringify(patch.definition) !== JSON.stringify(existing.definition)

    const data: Prisma.AutomationUpdateInput = {}
    if (patch.name !== undefined) data.name = patch.name
    if (patch.description !== undefined) data.description = patch.description
    if (patch.dryRunMode !== undefined) data.dryRunMode = patch.dryRunMode
    if (patch.maxRunsPerHour !== undefined) data.maxRunsPerHour = patch.maxRunsPerHour
    if (patch.requireApproval !== undefined) data.requireApproval = patch.requireApproval
    if (patch.isActive !== undefined) data.isActive = patch.isActive
    if (patch.isPaused !== undefined) data.isPaused = patch.isPaused
    if (patch.killSwitch !== undefined) data.killSwitch = patch.killSwitch

    if (hasDefinitionChange) {
      data.previousDefinition = existing.definition as unknown as Prisma.InputJsonValue
      data.definition = patch.definition as unknown as Prisma.InputJsonValue
      data.version = { increment: 1 }
    } else if (patch.definition !== undefined) {
      // Definition present but unchanged — still write it (no-op) but skip
      // the version bump + snapshot so we don't churn history.
      data.definition = patch.definition as unknown as Prisma.InputJsonValue
    }

    const row = await db.automation.update({ where: { id }, data })
    return toAutomationItem(row)
  }

  /**
   * Activate the workspace-wide kill switch: set `killSwitch=true` on every
   * automation in the workspace. Returns the count affected.
   */
  async activateKillSwitch(workspaceId: string): Promise<number> {
    const result = await db.automation.updateMany({
      where: { workspaceId, killSwitch: false },
      data: { killSwitch: true },
    })
    return result.count
  }

  /** Clear the kill switch on every automation in the workspace. */
  async deactivateKillSwitch(workspaceId: string): Promise<number> {
    const result = await db.automation.updateMany({
      where: { workspaceId, killSwitch: true },
      data: { killSwitch: false },
    })
    return result.count
  }

  // ── Runs ──────────────────────────────────────────────────────────────────

  /** List runs for an automation, cursor-paginated by createdAt desc. */
  async listRuns(
    automationId: string,
    workspaceId: string,
    query: AutomationRunListQuery
  ): Promise<AutomationRunItem[]> {
    const limit = query.limit ?? 20
    const rows = await db.automationRun.findMany({
      where: {
        automationId,
        workspaceId,
        ...(query.cursor ? { id: { lt: query.cursor } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    })
    return rows.map(toRunItem)
  }

  /** Find a single run within a workspace (ownership check). */
  async findRunById(id: string, workspaceId: string): Promise<AutomationRunItem | null> {
    const row = await db.automationRun.findFirst({ where: { id, workspaceId } })
    return row ? toRunItem(row) : null
  }

  /** Create a new run row (engine calls this on every fire). */
  async createRun(
    workspaceId: string,
    input: {
      automationId: string
      version: number
      trigger: Record<string, unknown>
      conditions: Record<string, unknown>
      actions: Record<string, unknown>
      status: string
      error?: string | null
      startedAt?: Date | null
      completedAt?: Date | null
    }
  ): Promise<AutomationRunItem> {
    const row = await db.automationRun.create({
      data: {
        workspaceId,
        automationId: input.automationId,
        version: input.version,
        trigger: input.trigger as Prisma.InputJsonValue,
        conditions: input.conditions as Prisma.InputJsonValue,
        actions: input.actions as Prisma.InputJsonValue,
        status: input.status,
        error: input.error ?? null,
        startedAt: input.startedAt ?? null,
        completedAt: input.completedAt ?? null,
      },
    })
    return toRunItem(row)
  }

  /** Update a run (engine advances status / fills error / sets timestamps). */
  async updateRun(
    id: string,
    data: Partial<{
      status: string
      error: string | null
      startedAt: Date | null
      completedAt: Date | null
    }>
  ): Promise<AutomationRunItem | null> {
    const row = await db.automationRun.update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
      },
    })
    return toRunItem(row)
  }
}
