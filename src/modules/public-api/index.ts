/**
 * Issue #255: Public API v1 — module barrel.
 *
 * Re-exports the service singleton + DTO types so v1 route handlers can
 * import from a single entry point:
 *   import { publicApiService, type PublicContentItem } from '@/modules/public-api'
 */

export { PublicApiService, publicApiService } from './service'
export type {
  CursorListQuery,
  CursorListResult,
  PublicContentItem,
  PublicPublicationItem,
  PublicInboxItem,
  PublicReportDay,
  PublicReportResult,
} from './types'
