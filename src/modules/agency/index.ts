/**
 * Issue #254: Agency multi-client overview domain module — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { agencyService, AgencyError } from '@/modules/agency'
 */

export { AgencyService, agencyService } from './service'
export { AgencyRepository } from './repository'
export type {
  AuthContext,
  AgencyProfileItem,
  UpdateAgencyProfileInput,
  ClientWorkspaceSummary,
  WorkspaceTemplateItem,
  WorkspaceTemplateConfig,
  CreateTemplateInput,
  UpdateTemplateInput,
  ClientPortalAccessItem,
  CreatePortalAccessInput,
  PublicPortalPayload,
  AgencyOverview,
} from './types'
export {
  AgencyError,
  AgencyNotFoundError,
  TemplateNotFoundError,
  PortalAccessNotFoundError,
  ValidationError,
} from './errors'
