/**
 * Issue #212: Content versioning + revision history — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { revisionsService, RevisionNotFoundError } from '@/modules/revisions'
 */

export { RevisionsService, revisionsService, ContentNotFoundError } from './service'
export { RevisionsRepository } from './repository'
export type {
  AuthContext,
  RevisionRow,
  RevisionPayload,
  CreateRevisionInput,
  FieldDiff,
  RevisionDiff,
  RestoreResult,
} from './types'
export {
  RevisionError,
  RevisionNotFoundError,
  ValidationError,
} from './errors'
