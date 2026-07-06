/**
 * Issue #249: Versioned workflow builder — types.
 *
 * An Automation is a saved, versioned trigger→condition→action pipeline
 * (think Zapier-for-Nashrino). Each save increments `version` and stores the
 * previous definition for rollback. Automations support:
 *   - Dry-run mode (log what would happen, don't execute actions)
 *   - Per-hour rate limiting
 *   - Approval gate (require human approval before AI-generated actions)
 *   - A workspace-wide kill switch (immediately halt every run)
 *
 * `AutomationRun` records the step-level execution detail of one fire:
 *   - Which trigger fired (with matchedData)
 *   - Which conditions evaluated (passed/failed per condition)
 *   - Which actions executed (status/result/error per action)
 *   - Overall status (pending, running, completed, failed, cancelled,
 *     approval_required)
 */

export interface AuthContext {
  workspaceId: string
  userId: string
}

// ── Definition pieces ────────────────────────────────────────────────────────
//
// The full definition is stored as one JSON column on `Automation`. Each piece
// (trigger / condition / action) is `{ type, config }` where `config` is a
// free-form record whose shape is determined by `type`. Keeping config loose
// lets us add new trigger/condition/action types without a Prisma migration;
// the runtime engine + Zod schemas validate config shapes per type.

export type TriggerType =
  | 'schedule'
  | 'keyword'
  | 'status_change'
  | 'provider_event'
  | 'date_holiday'

export type ConditionType =
  | 'channel'
  | 'tag'
  | 'campaign'
  | 'time_window'
  | 'approval_state'

export type ActionType =
  | 'create_draft'
  | 'add_to_queue'
  | 'send_notification'
  | 'assign_inbox'
  | 'add_reply'
  | 'add_tag'
  | 'call_webhook'

export interface Trigger {
  type: TriggerType
  config: Record<string, unknown>
}

export interface Condition {
  type: ConditionType
  config: Record<string, unknown>
}

export interface Action {
  type: ActionType
  config: Record<string, unknown>
}

export interface AutomationDefinition {
  triggers: Trigger[]
  conditions: Condition[]
  actions: Action[]
}

// ── Item shapes ──────────────────────────────────────────────────────────────

export interface AutomationItem {
  id: string
  workspaceId: string
  name: string
  description: string | null
  version: number
  definition: AutomationDefinition
  previousDefinition: AutomationDefinition | null
  isActive: boolean
  isPaused: boolean
  dryRunMode: boolean
  killSwitch: boolean
  maxRunsPerHour: number
  requireApproval: boolean
  createdById: string
  createdAt: Date
  updatedAt: Date
}

export interface AutomationRunItem {
  id: string
  automationId: string
  version: number
  trigger: Record<string, unknown>
  conditions: Record<string, unknown>
  actions: Record<string, unknown>
  status: string
  error: string | null
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
}

// ── List query / result ──────────────────────────────────────────────────────

export interface AutomationListQuery {
  cursor?: string
  limit?: number
}

export interface AutomationListResult {
  data: AutomationItem[]
  nextCursor: string | null
}

export interface AutomationRunListQuery {
  cursor?: string
  limit?: number
}

export interface AutomationRunListResult {
  data: AutomationRunItem[]
  nextCursor: string | null
}

// ── Create / Update inputs ───────────────────────────────────────────────────

export interface CreateAutomationInput {
  name: string
  description?: string
  definition: AutomationDefinition
  dryRunMode?: boolean
  maxRunsPerHour?: number
  requireApproval?: boolean
}

export interface UpdateAutomationInput extends Partial<CreateAutomationInput> {
  isActive?: boolean
  isPaused?: boolean
  killSwitch?: boolean
}
