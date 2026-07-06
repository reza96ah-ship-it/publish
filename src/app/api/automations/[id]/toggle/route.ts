/**
 * Issue #249: Automations API — toggle active / paused / dry-run.
 *
 *   POST /api/automations/[id]/toggle  — { isActive } | { isPaused } | { dryRunMode }
 *
 * Body shape: exactly one of `isActive`, `isPaused`, `dryRunMode` must be
 * present (a boolean). The service routes to the matching toggle method.
 * These are operational toggles — they do NOT bump the automation version.
 *
 * Requires `workspace.settings`.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody, validateId } from '@/lib/validations'
import { automationsService, AutomationError } from '@/modules/automations'

export const dynamic = 'force-dynamic'

const toggleSchema = z
  .object({
    isActive: z.boolean().optional(),
    isPaused: z.boolean().optional(),
    dryRunMode: z.boolean().optional(),
  })
  .refine(
    (data) =>
      [data.isActive, data.isPaused, data.dryRunMode].filter((v) => v !== undefined).length === 1,
    { message: 'دقیقاً یکی از isActive، isPaused یا dryRunMode را ارسال کنید' }
  )

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) {
    return NextResponse.json({ error: idCheck.error }, { status: 400 })
  }

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }
  const validation = validateBody(toggleSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const auth = { workspaceId: guard.workspaceId, userId: guard.userId }
  try {
    const data = validation.data
    let item
    if (data.isActive !== undefined) {
      item = await automationsService.toggleActive(auth, idCheck.data, data.isActive)
    } else if (data.isPaused !== undefined) {
      item = await automationsService.togglePaused(auth, idCheck.data, data.isPaused)
    } else if (data.dryRunMode !== undefined) {
      item = await automationsService.toggleDryRun(auth, idCheck.data, data.dryRunMode)
    } else {
      return NextResponse.json({ error: 'ورودی نامعتبر است' }, { status: 400 })
    }
    return NextResponse.json(item)
  } catch (err) {
    if (err instanceof AutomationError) {
      return NextResponse.json(
        { error: err.userMessage ?? err.message },
        { status: err.statusCode }
      )
    }
    throw err
  }
}
