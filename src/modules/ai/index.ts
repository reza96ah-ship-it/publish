/**
 * Issue #200: AI domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point: `import { aiService } from '@/modules/ai'`
 */

export { AIService, aiService, VALID_PLATFORMS } from './service'
export type { WorkspaceContext } from './service'
export type {
  CaptionStreamInput,
  CaptionMultiStreamInput,
  DraftItem,
  DraftListQuery,
  SaveDraftInput,
  SaveDraftResult,
  AuthContext,
} from './types'
