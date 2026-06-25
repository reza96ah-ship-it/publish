import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'
import { randomUUID } from 'crypto'

interface PatchBody {
  action: 'retry' | 'discard'
}

/**
 * PATCH /api/publish-jobs/[id]
 * - retry: re-arm idempotency key (new), reset retryCount, set status=pending
 * - discard: set status=failed permanently, clear scheduledAt
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  }

  const { id } = await params
  let body: PatchBody
  try {
    body = (await req.json()) as PatchBody
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const job = await db.publishJob.findFirst({
    where: { id, workspaceId },
  })
  if (!job) {
    return NextResponse.json({ error: 'کار یافت نشد' }, { status: 404 })
  }

  if (body.action === 'retry') {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'pending',
        retryCount: 0,
        progress: 0,
        processLabel: 'در انتظار تلاش مجدد',
        error: null,
        idempotencyKey: randomUUID(), // new key for idempotent retry
        scheduledAt: null, // process immediately
        startedAt: null,
        completedAt: null,
        externalId: null,
      },
    })
    return NextResponse.json({
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار برای تلاش مجدد به صف بازگردانده شد',
    })
  }

  if (body.action === 'discard') {
    const updated = await db.publishJob.update({
      where: { id },
      data: {
        status: 'failed',
        processLabel: 'دست‌نگار discard شد',
        scheduledAt: null,
        completedAt: new Date(),
      },
    })
    return NextResponse.json({
      ok: true,
      jobId: updated.id,
      status: updated.status,
      message: 'کار discarded شد',
    })
  }

  return NextResponse.json({ error: 'action نامعتبر است (retry یا discard)' }, { status: 400 })
}
