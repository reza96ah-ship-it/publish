/**
 * Issue #248: Customer profiles + case management — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { customersService, CustomerError } from '@/modules/customers'
 */

export { CustomersService, customersService } from './service'
export { CustomersRepository } from './repository'
export type {
  AuthContext,
  SocialHandles,
  ConsentStatus,
  InteractionType,
  InteractionDirection,
  CaseStatus,
  CasePriority,
  ParticipantRole,
  CustomerItem,
  CustomerInteractionItem,
  CaseItem,
  CaseParticipantItem,
  CustomerDetail,
  CaseDetail,
  CustomerListQuery,
  CustomerListResult,
  CaseListQuery,
  CaseListResult,
  CreateCustomerInput,
  UpdateCustomerInput,
  CreateInteractionInput,
  CreateCaseInput,
  UpdateCaseInput,
  AddParticipantInput,
} from './types'
export {
  CustomerError,
  CustomerNotFoundError,
  CaseNotFoundError,
  ParticipantNotFoundError,
  DuplicateParticipantError,
  MergeConflictError,
  ValidationError,
} from './errors'
