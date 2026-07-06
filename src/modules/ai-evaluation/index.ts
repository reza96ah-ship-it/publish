/**
 * Issue #252: AI evaluation harness — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { aiEvaluationService, AIEvaluationError } from '@/modules/ai-evaluation'
 */

export { AIEvaluationService, aiEvaluationService } from './service'
export { AIEvaluationRepository } from './repository'
export { SEED_EVALUATION_SETS } from './seed-evaluation-set'
export type {
  AuthContext,
  EvaluationTone,
  SeedPrompt,
  EvaluationSet,
  EvaluationResult,
  CreateSetInput,
  RunEvaluationInput,
  SubmitFeedbackInput,
} from './types'
export {
  AIEvaluationError,
  EvaluationSetNotFoundError,
  EvaluationResultNotFoundError,
  ValidationError,
  CaptionGenerationError,
} from './errors'
