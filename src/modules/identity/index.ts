/**
 * Identity domain module — public API.
 *
 * Route handlers import from this single entry point:
 *   import { identityService, IdentityError } from '@/modules/identity'
 */

export { IdentityService } from './service'
export { IdentityRepository } from './repository'
export type {
  AuthContext,
  MfaSetupResult,
  MfaVerifyResult,
  MfaUserState,
} from './types'
export {
  IdentityError,
  ValidationError,
  MfaNotPendingError,
  MfaInvalidCodeError,
  MfaNotEnabledError,
  MfaInvalidDisableCodeError,
} from './errors'

import { IdentityService } from './service'
export const identityService = new IdentityService()
