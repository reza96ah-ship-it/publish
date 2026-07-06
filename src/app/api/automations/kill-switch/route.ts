/**
 * Issue #249: Automations API — workspace-wide kill switch.
 *
 *   POST /api/automations/kill-switch  — { activate: boolean }
 *
 * When `activate: true`, sets `killSwitch=true` on EVERY automation in the
 * workspace — immediately halting all in-flight + future runs. When
 * `activate: false`, clears the flag (idempotent — clears even if some were
 * already cleared). Returns `{ count }` of affected automations.
 *
 * Requires `workspace.settings` (admin-only). This is the panic button.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { automationsService, AutomationError } from '@/modules/automations'

export const dynamic = 'force-dynamic'

const killSwitchSchema = z.object({
  activate: z.boolean({ message: 'فیلد activate الزامی است' }),
})

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const raw = await req.json().catch(() => null)
  if (!raw) {
    return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  }
  const validation = validateBody(killSwitchSchema, raw)
  if (!validation.success) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  try {
    const auth = { workspaceId: guard.workspaceId, userId: guard.userId }
    const result = validation.data.activate
      ? await automationsService.activateKillSwitch(auth)
      : await automationsService.deactivateKillSwitch(auth)
    return NextResponse.json(result)
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
