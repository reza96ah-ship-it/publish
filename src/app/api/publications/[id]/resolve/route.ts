/**
 * POST /api/publications/[id]/resolve — manual resolution for unknown outcomes (Issue #149).
 *
 * Admin-only (security.admin). Allows an operator to manually resolve a
 * publication stuck in 'outcome_unknown' state after reconciliation failed.
 *
 * Actions:
 *   - mark_published: operator confirms the post was externally published
 *     (with a provider URL/ID)
 *   - confirm_failure: operator confirms the post was NOT published → allow retry
 *   - abandon: operator gives up → mark as permanently failed
 *   - duplicate_safe_retry: operator confirms it's safe to retry (provider
 *     supports idempotency) → re-enqueue
 *
 * Requires audit reason + confirmation. Preserves the original ambiguous attempt.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const resolveSchema = z.object({
  action: z.enum(['mark_published', 'confirm_failure', 'abandon', 'duplicate_safe_retry']),
  providerPostId: z.string().optional(), // required for mark_published
  reason: z.string().min(10, 'دلیل الزامی است (حداقل ۱۰ کاراکتر)'),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const guard = await requirePermissionApi('security.admin')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'بدنه نامعتبر' }, { status: 400 })

  const validation = resolveSchema.safeParse(body)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'نامعتبر' }, { status: 400 })
  }
  const { action, providerPostId, reason } = validation.data

  // Find the publication — must be in outcome_unknown state + belong to workspace
  const publication = await db.publication.findFirst({
    where: { id, workspaceId },
  })

  if (!publication) {
    return NextResponse.json({ error: 'انتشار یافت نشد' }, { status: 404 })
  }

  if (publication.reconciliationStatus === 'confirmed_success' || publication.reconciliationStatus === 'confirmed_failure') {
    return NextResponse.json({ error: 'این انتشار قبلاً حل شده است' }, { status: 400 })
  }

  const now = new Date()

  switch (action) {
    case 'mark_published': {
      if (!providerPostId) {
        return NextResponse.json({ error: 'شناسه پست ارائه‌دهنده برای تأیید انتشار الزامی است' }, { status: 400 })
      }
      await db.publication.update({
        where: { id },
        data: {
          status: 'success',
          providerPostId,
          providerAcknowledgedAt: now,
          reconciliationStatus: 'confirmed_success',
          completedAt: now,
        },
      })
      break
    }

    case 'confirm_failure': {
      await db.publication.update({
        where: { id },
        data: {
          status: 'failed',
          reconciliationStatus: 'confirmed_failure',
          errorCategory: 'unknown',
          errorMessage: `تأیید شده توسط اپراتور: ${reason}`,
          completedAt: now,
        },
      })
      break
    }

    case 'abandon': {
      await db.publication.update({
        where: { id },
        data: {
          status: 'failed',
          reconciliationStatus: 'confirmed_failure',
          errorCategory: 'unknown',
          errorMessage: `رها شده توسط اپراتور: ${reason}`,
          completedAt: now,
        },
      })
      break
    }

    case 'duplicate_safe_retry': {
      // Reset to pending so the outbox dispatcher re-enqueues it
      await db.publication.update({
        where: { id },
        data: {
          status: 'pending',
          reconciliationStatus: null,
          errorMessage: null,
          errorCategory: null,
        },
      })
      // Create a new outbox event for re-dispatch
      await db.outboxEvent.create({
        data: {
          workspaceId,
          aggregateType: 'content',
          aggregateId: publication.contentId,
          eventType: 'publish_requested',
          payload: {
            jobId: publication.publishJobId,
            contentId: publication.contentId,
            platformId: publication.platformId,
            workspaceId,
            publicationId: id,
            revisionId: publication.revisionId,
          },
          status: 'pending',
          availableAt: now,
        },
      })
      break
    }
  }

  // Write audit event (preserves the original ambiguous attempt)
  await db.auditLog.create({
    data: {
      userId: guard.userId,
      workspaceId,
      action: `publication.resolved.${action}`,
      resource: 'Publication',
      metadata: {
        publicationId: id,
        action,
        providerPostId: providerPostId ?? null,
        reason,
        previousStatus: publication.status,
        previousReconciliation: publication.reconciliationStatus,
      },
    },
  })

  const actionMessages: Record<string, string> = {
    mark_published: 'انتشار به عنوان موفق تأیید شد',
    confirm_failure: 'انتشار به عنوان ناموفق تأیید شد — امکان تلاش مجدد وجود دارد',
    abandon: 'انتشار رها شد',
    duplicate_safe_retry: 'انتشار برای تلاش مجدد ایمن به صف بازگردانده شد',
  }

  return NextResponse.json({
    ok: true,
    message: actionMessages[action],
    action,
  })
}
