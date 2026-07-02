/**
 * Issue #156: Media domain module — service layer.
 *
 * Business logic only — no HTTP, no direct Prisma. Uses the repository for
 * data access and src/lib/storage for object storage. This makes the service
 * unit-testable with a mock repository.
 *
 * Orchestrates: quota check → presign → create pending row, or
 * fetch object → magic-byte check → sharp/ffprobe → finalize.
 */

import {
  createPresignedUpload,
  buildStorageKey,
  isS3Configured,
  fetchObject,
  deleteObject,
  validateMagicBytes,
  sha256,
  buildDerivedKey,
  putObject,
  publicUrlFor,
  type MagicByteResult,
} from '@/lib/storage'
import { probeVideo } from '@/lib/video-probe'
import sharp from 'sharp'
import { MediaRepository } from './repository'
import {
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
} from './errors'
import type {
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
  RejectedReason,
} from './types'

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
] as const

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200MB
const STORAGE_QUOTA_BYTES = 500 * 1024 * 1024 // 500MB per workspace (validated assets only)
const MAX_CONCURRENT_PENDING = 20 // per workspace — bounds abandoned-upload growth
const PENDING_UPLOAD_TTL_MS = 15 * 60 * 1000 // 15 minutes

// Decompression-bomb guard: refuse to decode images with an absurd pixel count
// or any single dimension beyond a sane ceiling.
const MAX_IMAGE_PIXELS = 40_000_000 // ~40MP (e.g. 8000x5000)
const MAX_IMAGE_DIMENSION = 8000

export class MediaService {
  constructor(
    private readonly repo: MediaRepository = new MediaRepository()
  ) {}

  /**
   * POST /api/media/presign — issue a presigned upload URL + create a pending row.
   *
   * @throws {ValidationError} — invalid file type
   * @throws {FileTooLargeError} — file size over the per-type limit
   * @throws {TooManyPendingUploadsError} — too many concurrent uploads
   * @throws {QuotaExceededError} — workspace storage quota would be exceeded
   */
  async presign(auth: AuthContext, body: PresignRequest): Promise<PresignResult> {
    const { workspaceId } = auth

    // Type whitelist
    if (!ALLOWED_TYPES.includes(body.fileType as (typeof ALLOWED_TYPES)[number])) {
      throw new ValidationError(
        'فرمت فایل پشتیبانی نمی‌شود. فقط JPEG, PNG, WebP, GIF, MP4, MOV یا WebM مجاز است'
      )
    }

    // Per-type size limit
    const isVideo = body.fileType.startsWith('video/')
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    if (body.fileSize > maxBytes) {
      throw new FileTooLargeError(
        isVideo ? 'حداکثر حجم ویدیو ۲۰۰ مگابایت است' : 'حداکثر حجم تصویر ۱۰ مگابایت است'
      )
    }

    // Bound concurrent abandoned/in-flight uploads per workspace
    const pendingCount = await this.repo.countPending(workspaceId)
    if (pendingCount >= MAX_CONCURRENT_PENDING) {
      throw new TooManyPendingUploadsError(
        'تعداد آپلودهای در حال انجام زیاد است. کمی صبر کنید و دوباره تلاش کنید'
      )
    }

    // Quota counts only validated assets — pending uploads don't consume it
    const usedBytes = await this.repo.sumValidatedBytes(workspaceId)
    if (usedBytes + body.fileSize > STORAGE_QUOTA_BYTES) {
      const remaining = Math.max(0, STORAGE_QUOTA_BYTES - usedBytes)
      throw new QuotaExceededError(
        `سقف ذخیره‌سازی تکمیل است. فضای باقیمانده: ${Math.round(remaining / 1024 / 1024)} مگابایت`
      )
    }

    // Server-owned, unpredictable key under the workspace prefix — never client-supplied
    const key = buildStorageKey(workspaceId, body.fileType)
    const { uploadUrl } = await createPresignedUpload({ key, fileType: body.fileType })
    const expiresAt = new Date(Date.now() + PENDING_UPLOAD_TTL_MS)

    const media = await this.repo.createPending({
      workspaceId,
      uploaderId: auth.userId,
      name: body.fileName,
      fileType: body.fileType,
      fileSize: body.fileSize,
      declaredType: body.fileType,
      storageKey: key,
      storageProvider: isS3Configured ? 's3' : 'local',
      expiresAt,
    })

    return { uploadUrl, key, mediaId: media.id }
  }

  /**
   * POST /api/media/confirm — validate the uploaded object + finalize the row.
   *
   * Idempotent — re-confirming an already-validated row returns the same result.
   * On any validation failure: deletes the stored object and marks the row
   * "rejected" with a safe reason (audit trail preserved).
   */
  async confirm(auth: AuthContext, body: ConfirmRequest): Promise<ConfirmResult> {
    const { workspaceId } = auth

    const media = await this.repo.findByIdInWorkspace(body.mediaId, workspaceId)
    if (!media) throw new MediaNotFoundError()

    // Idempotent: re-confirming an already-validated asset just returns the same result
    if (media.status === 'validated') {
      return { ok: true, media: toMediaPayload(media) }
    }

    if (media.status === 'rejected') {
      throw new MediaAlreadyRejectedError('این فایل قبلاً رد شده است. لطفاً دوباره آپلود کنید')
    }

    if (media.status !== 'uploaded') {
      throw new MediaNotUploadedyetError('فایل هنوز آپلود نشده است')
    }

    if (media.expiresAt && media.expiresAt < new Date()) {
      await this.reject(media.id, media.storageKey, 'expired', 'مهلت آپلود منقضی شده است')
      throw new UploadExpiredError('مهلت آپلود منقضی شده است')
    }

    await this.repo.updateStatus(media.id, 'validating')

    const buffer = await fetchObject(media.storageKey)
    if (!buffer) {
      await this.reject(media.id, media.storageKey, 'object_missing', 'فایل آپلودشده یافت نشد')
      throw new MediaNotFoundError('فایل آپلودشده یافت نشد')
    }

    // Defense in depth: the bytes we validate must match what was hashed during upload
    if (media.checksumValue && sha256(buffer) !== media.checksumValue) {
      await this.reject(media.id, media.storageKey, 'checksum_mismatch', 'فایل آپلودشده دستکاری شده است')
      throw new ChecksumMismatchError('فایل آپلودشده دستکاری شده است')
    }
    if (media.actualSize != null && buffer.length !== media.actualSize) {
      await this.reject(media.id, media.storageKey, 'size_mismatch', 'حجم فایل مطابقت ندارد')
      throw new SizeMismatchError('حجم فایل مطابقت ندارد')
    }

    const detected = validateMagicBytes(buffer)
    if (!detected.valid || !detected.kind) {
      await this.reject(media.id, media.storageKey, 'unsupported_format', 'فرمت فایل پشتیبانی نمی‌شود')
      throw new UnsupportedFormatError('فرمت فایل پشتیبانی نمی‌شود')
    }

    const declaredKind = media.declaredType?.startsWith('video/') ? 'video' : 'image'
    if (detected.kind !== declaredKind) {
      await this.reject(
        media.id,
        media.storageKey,
        'type_mismatch',
        'نوع فایل واقعی با نوع اعلام‌شده مطابقت ندارد'
      )
      throw new TypeMismatchError('نوع فایل واقعی با نوع اعلام‌شده مطابقت ندارد')
    }

    let width: number | null = detected.width ?? null
    let height: number | null = detected.height ?? null
    let thumbnailUrl: string | null = null
    let durationMs: number | null = null
    let codec: string | null = null

    if (detected.kind === 'image') {
      const result = await this.processImage(media, buffer, detected)
      width = result.width
      height = result.height
      thumbnailUrl = result.thumbnailUrl
    }
    if (detected.kind === 'video') {
      // Best-effort: a probe/thumbnail failure does not reject the upload.
      // Issue #146 follow-up: extract duration/codec via ffprobe and generate a
      // real thumbnail frame via ffmpeg — both shell out to the system binary
      // (see src/lib/video-probe.ts for why, not a bundled npm package).
      try {
        const probeType =
          detected.type === 'mov' || detected.type === 'webm' ? detected.type : 'mp4'
        const probed = await probeVideo(buffer, probeType)
        durationMs = probed.durationMs
        codec = probed.codec
        if (probed.thumbnail) {
          const thumbKey = buildDerivedKey(media.storageKey, 'thumb.jpg')
          thumbnailUrl = await putObject(thumbKey, probed.thumbnail, 'image/jpeg')
        }
      } catch (err) {
        console.error('[media/confirm] video probe failed (non-fatal):', err)
      }
    }

    const publicUrl = publicUrlFor(media.storageKey)
    const updated = await this.repo.finalizeValidated(media.id, {
      detectedType: detected.type ?? null,
      width,
      height,
      url: publicUrl,
      thumbnailUrl: thumbnailUrl ?? publicUrl,
      durationMs,
      codec,
    })

    return { ok: true, media: toMediaPayload(updated) }
  }

  /**
   * Decode an image with sharp, enforce pixel/dimension guards, and generate
   * a 400x400 webp thumbnail.
   */
  private async processImage(
    media: MediaRow,
    buffer: Buffer,
    detected: MagicByteResult
  ): Promise<{ width: number | null; height: number | null; thumbnailUrl: string | null }> {
    let width: number | null = detected.width ?? null
    let height: number | null = detected.height ?? null
    let thumbnailUrl: string | null = null
    try {
      const img = sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
      const metadata = await img.metadata()
      width = metadata.width ?? width
      height = metadata.height ?? height

      if (
        !width ||
        !height ||
        width > MAX_IMAGE_DIMENSION ||
        height > MAX_IMAGE_DIMENSION ||
        width * height > MAX_IMAGE_PIXELS
      ) {
        await this.reject(
          media.id,
          media.storageKey,
          'image_too_large',
          'ابعاد تصویر بیش از حد مجاز است'
        )
        throw new ImageTooLargeError('ابعاد تصویر بیش از حد مجاز است')
      }

      const thumbBuffer = await sharp(buffer, { limitInputPixels: MAX_IMAGE_PIXELS })
        .resize(400, 400, { fit: 'cover', position: 'center' })
        .webp({ quality: 80 })
        .toBuffer()

      const thumbKey = buildDerivedKey(media.storageKey, 'thumb.webp')
      thumbnailUrl = await putObject(thumbKey, thumbBuffer, 'image/webp')
    } catch (err) {
      if (err instanceof ImageTooLargeError) throw err
      await this.reject(media.id, media.storageKey, 'decode_failed', 'پردازش تصویر ناموفق بود')
      throw new ImageDecodeFailedError('پردازش تصویر ناموفق بود')
    }
    return { width, height, thumbnailUrl }
  }

  /**
   * DELETE /api/media/[id] — remove a validated media asset.
   *
   * Idempotent: deleting an already-deleted asset returns ok.
   * Refuses to delete an asset still referenced by a non-terminal publication.
   */
  async delete(auth: AuthContext, mediaId: string): Promise<DeleteResult> {
    const { workspaceId } = auth

    const media = await this.repo.findByIdInWorkspace(mediaId, workspaceId)
    if (!media) throw new MediaNotFoundError()

    if (media.status === 'deleted') {
      return { ok: true }
    }

    // Block deletion of an asset an active (non-terminal) publication still depends on
    const referencingRevisions = await this.repo.findRevisionsReferencingMedia(mediaId)
    if (referencingRevisions.length > 0) {
      const activePublication = await this.repo.findActivePublicationForRevisions(
        referencingRevisions.map((r) => r.revisionId)
      )
      if (activePublication) {
        throw new MediaReferencedByActivePublicationError(
          'این رسانه در یک انتشار فعال استفاده شده است. ابتدا انتشار را لغو یا ویرایش کنید'
        )
      }
    }

    await this.repo.updateStatus(mediaId, 'deleting')

    await deleteObject(media.storageKey)
    if (media.thumbnailUrl && media.thumbnailUrl !== media.url) {
      await deleteObject(buildDerivedKey(media.storageKey, 'thumb.webp'))
    }

    await this.repo.updateStatus(mediaId, 'deleted')

    return { ok: true }
  }

  /**
   * GET /api/media — cursor-paginated list of validated media for the library.
   * Pending/rejected/deleting assets are never listed.
   */
  async list(auth: AuthContext, query: ListQuery): Promise<ListResult> {
    const { workspaceId } = auth
    const items = await this.repo.listValidated(workspaceId, query)
    const hasMore = items.length > query.limit
    const data = hasMore ? items.slice(0, query.limit) : items
    const nextCursor = hasMore ? data[data.length - 1]?.id ?? null : null
    return { data: data.map(toMediaPayload), nextCursor }
  }

  /**
   * Reject helper: deletes the stored object + marks the row "rejected".
   * Failure of the storage delete is logged but not surfaced — the row is
   * marked rejected regardless so it can't be finalized later.
   */
  private async reject(
    mediaId: string,
    storageKey: string,
    reason: RejectedReason,
    _userMessage: string
  ): Promise<void> {
    try {
      await deleteObject(storageKey)
    } catch (err) {
      console.error('[media] reject: failed to delete storage object:', err)
    }
    await this.repo.markRejected(mediaId, reason)
  }
}

function toMediaPayload(m: MediaRow): MediaPayload {
  return {
    id: m.id,
    name: m.name,
    fileType: m.fileType,
    fileSize: m.fileSize,
    url: m.url,
    thumbnail: m.thumbnailUrl ?? m.url,
    width: m.width,
    height: m.height,
    durationMs: m.durationMs ?? null,
    codec: m.codec ?? null,
  }
}
