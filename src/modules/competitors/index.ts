/**
 * Issue #253: Competitor tracking — public API.
 *
 * Re-exports the service singleton + repository class + types + errors so
 * route handlers can import from a single entry point:
 *   import { competitorsService, CompetitorError } from '@/modules/competitors'
 */

export { CompetitorsService, competitorsService } from './service'
export { CompetitorsRepository } from './repository'
export type {
  AuthContext,
  CompetitorProfile,
  BenchmarkResult,
  ShareOfVoice,
  CreateCompetitorInput,
  UpdateCompetitorInput,
  BenchmarkQuery,
  ShareOfVoiceQuery,
} from './types'
export {
  CompetitorError,
  CompetitorNotFoundError,
  ValidationError,
} from './errors'
