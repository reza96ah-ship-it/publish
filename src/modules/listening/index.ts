/**
 * Issue #251: Social listening foundation + spike alerts — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { listeningService, ListeningError } from '@/modules/listening'
 */

export { ListeningService, listeningService } from './service'
export { ListeningRepository } from './repository'
export type {
  AuthContext,
  ListeningQueryItem,
  ListeningMentionItem,
  ListeningListQuery,
  ListeningListResult,
  MentionListQuery,
  MentionListResult,
  CreateListeningQueryInput,
  UpdateListeningQueryInput,
  SpikeAlert,
  CoverageDisclosure,
  CoverageProvider,
  CreateListeningMentionInput,
} from './types'
export {
  ListeningError,
  ListeningQueryNotFoundError,
  ListeningValidationError,
} from './errors'
