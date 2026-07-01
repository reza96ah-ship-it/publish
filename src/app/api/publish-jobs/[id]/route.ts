/**
 * PATCH /api/publish-jobs/[id] — retry / cancel / discard / reschedule (Issue #147, #156).
 *
 * Thin transport handler: auth → parse body → service.patchJob() → map.
 *
 * The service (src/modules/publications/job-service.ts) owns all business
 * logic: non-cancellable status guard, Publication cross-check, optimistic
 * concurrency, BullMQ old-job removal, audit log, Content aggregate recompute.
 *
 * Reschedule uses rescheduleSchema for Zod validation; the other actions
 * only need their `action` discriminator.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { rescheduleSchema, validateBody } from '@/lib/validations'
import {
  PublishJobService,
  JobNotFoundError,
  JobNotCancellableError,
  JobConcurrentChangeError,
  InvalidActionError,
  ValidationError,
} from '@/modules/publications/job-service'
import {
  JobNotFoundError as PubJobNotFoundError,
  JobNotCancellableError as PubJobNotCancellableError,
  JobConcurrentChangeError as PubJobConcurrentChangeError,
  InvalidActionError as PubInvalidActionError,
  ValidationError as PubValidationError,
} from '@/modules/publications/job-errors'
import { PublicationError } from '@/modules/publications/errors'

export const dynamic = 'force-dynamic'

type PatchBody =
  | { action: 'retry' }
  | { action: 'discard' }
  | { action: 'cancel' }
  | { action: 'reschedule'; scheduledAt: string }

const service = new PublishJobService()

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requirePermissionApi('job.schedule')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const { id } = await params
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const body = raw as PatchBody

  // Reschedule is the only action that needs schema validation — the others
  // are discriminated purely on the `action` string and have no payload.
  if (body.action === 'reschedule') {
    const parsed = validateBody(rescheduleSchema, body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 })
    }
  }

  try {
    const result = await service.patchJob(
      { workspaceId, userId: guard.userId },
      id,
      body
    )
    return NextResponse.json(result)
  } catch (err) {
    return mapJobError(err)
  }
}

function mapJobError(err: unknown) {
  if (
    err instanceof JobNotFoundError ||
    err instanceof JobNotCancellableError ||
    err instanceof JobConcurrentChangeError ||
    err instanceof InvalidActionError ||
    err instanceof ValidationError ||
    err instanceof PubJobNotFoundError ||
    err instanceof PubJobNotCancellableError ||
    err instanceof PubJobConcurrentChangeError ||
    err instanceof PubInvalidActionError ||
    err instanceof PubValidationError ||
    err instanceof PublicationError
  ) {
    const statusCode = (err as { statusCode: number }).statusCode
    const message = (err as { userMessage?: string; message: string }).userMessage ?? (err as { message: string }).message
    return NextResponse.json({ error: message }, { status: statusCode })
  }
  throw err
}
