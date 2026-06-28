/**
 * Issue #124: Publications domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point: `import { publicationsService, type PublishRequest } from '@/modules/publications'`
 */

export { PublicationsService } from './service'
export { PublicationsRepository } from './repository'
export type {
  PublishRequest,
  PublishResult,
  PublishMode,
  ScheduleMode,
  AuthContext,
} from './types'
export {
  PublicationError,
  ValidationError,
  PermissionDeniedError,
  NoChannelsError,
  ChannelsNotFoundError,
  InvalidBodyError,
} from './errors'
export { canPublish } from './permissions'

import { PublicationsService } from './service'
export const publicationsService = new PublicationsService()
