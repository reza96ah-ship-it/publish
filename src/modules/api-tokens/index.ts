/**
 * Issue #255: API Tokens domain module — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { apiTokensService, ApiTokenError } from '@/modules/api-tokens'
 */

export { ApiTokensService, apiTokensService } from './service'
export { ApiTokensRepository } from './repository'
export type {
  AuthContext,
  ApiTokenItem,
  CreateApiTokenInput,
  CreateApiTokenResult,
} from './types'
export { ApiTokenError, ApiTokenNotFoundError, ValidationError } from './errors'
