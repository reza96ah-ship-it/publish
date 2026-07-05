/**
 * Issue #250: Smart Pages domain module — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { smartPagesService, SmartPageError } from '@/modules/smart-pages'
 */

export { SmartPagesService, smartPagesService } from './service'
export { SmartPagesRepository } from './repository'
export type {
  AuthContext,
  SmartPageBlock,
  SmartPageItem,
  PublicSmartPageItem,
  SmartPageListQuery,
  SmartPageListResult,
  CreateSmartPageInput,
  UpdateSmartPageInput,
  ClickInput,
  ClickStat,
} from './types'
export {
  SmartPageError,
  SmartPageNotFoundError,
  SlugConflictError,
  ValidationError,
} from './errors'
