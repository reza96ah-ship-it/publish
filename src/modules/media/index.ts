/**
 * Issue #156: Media domain module — public API.
 *
 * Re-exports the service + types so route handlers can import from a single
 * entry point:
 *   import { mediaService, type PresignRequest } from '@/modules/media'
 */

export { MediaService } from './service'
export { MediaRepository } from './repository'
export type {
  AuthContext,
  PresignRequest,
  PresignResult,
  ConfirmRequest,
  ConfirmResult,
  DeleteResult,
  ListQuery,
  ListResult,
  MediaPayload,
  MediaRow,
  MediaStatus,
  RejectedReason,
} from './types'
export {
  MediaError,
  ValidationError,
  FileTooLargeError,
  QuotaExceededError,
  TooManyPendingUploadsError,
  MediaNotFoundError,
  MediaAlreadyRejectedError,
  MediaNotUploadedyetError,
  UploadExpiredError,
  MediaReferencedByActivePublicationError,
  UnsupportedFormatError,
  ChecksumMismatchError,
  SizeMismatchError,
  TypeMismatchError,
  ImageTooLargeError,
  ImageDecodeFailedError,
  LocalUploadDisabledError,
  InvalidStorageKeyError,
  PendingUploadNotFoundError,
  NotUploaderError,
  NoContentLengthError,
  DeclaredSizeMismatchError,
  EmptyBodyError,
  LocalUploadStreamError,
} from './errors'

import { MediaService } from './service'
export const mediaService = new MediaService()
