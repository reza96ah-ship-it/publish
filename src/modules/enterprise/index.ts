/**
 * Issue #256: Enterprise SSO + custom roles + audit export — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { enterpriseService, EnterpriseError } from '@/modules/enterprise'
 */

export { EnterpriseService, enterpriseService } from './service'
export { EnterpriseRepository } from './repository'
export type {
  AuthContext,
  SSOProvider,
  SSOConfigItem,
  CustomRoleItem,
  AuditExportConfig,
  AuditLogRow,
  CreateSSOConfigInput,
  UpdateSSOConfigInput,
  CreateCustomRoleInput,
  UpdateCustomRoleInput,
} from './types'
export {
  EnterpriseError,
  SSOConfigNotFoundError,
  CustomRoleNotFoundError,
  DuplicateRoleError,
  ValidationError,
} from './errors'
