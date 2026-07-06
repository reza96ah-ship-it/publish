/**
 * Issue #249: Versioned workflow builder — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { automationsService, AutomationError } from '@/modules/automations'
 */

export { AutomationsService, automationsService } from './service'
export { AutomationsRepository } from './repository'
export type {
  AuthContext,
  TriggerType,
  ConditionType,
  ActionType,
  Trigger,
  Condition,
  Action,
  AutomationDefinition,
  AutomationItem,
  AutomationRunItem,
  AutomationListQuery,
  AutomationListResult,
  AutomationRunListQuery,
  AutomationRunListResult,
  CreateAutomationInput,
  UpdateAutomationInput,
} from './types'
export {
  AutomationError,
  AutomationNotFoundError,
  ValidationError,
} from './errors'
