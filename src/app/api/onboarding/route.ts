import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { db } from '@/lib/db'
import { track } from '@/lib/track'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { workspaceId } = guard

  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      onboardingStep: true,
      onboardingCompleted: true,
      name: true,
      timezone: true,
      workWeek: true,
      platforms: { select: { id: true, type: true, status: true }, take: 5 },
    },
  })

  return NextResponse.json(ws)
}

const PatchSchema = z.object({
  step: z.number().int().min(0).max(10).optional(),
  completed: z.boolean().optional(),
  name: z.string().min(1).max(80).optional(),
  timezone: z.string().optional(),
  workWeek: z.enum(['sat-wed', 'mon-fri']).optional(),
})

export async function PATCH(req: Request) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const { workspaceId } = guard

  const body = await req.json()
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 })

  const { step, completed, ...workspaceFields } = parsed.data

  const updated = await db.workspace.update({
    where: { id: workspaceId },
    data: {
      ...(step !== undefined ? { onboardingStep: step } : {}),
      ...(completed !== undefined ? { onboardingCompleted: completed } : {}),
      ...workspaceFields,
    },
    select: { onboardingStep: true, onboardingCompleted: true },
  })

  // Fire-and-forget analytics for step completions
  if (step !== undefined) {
    void track({
      event: 'onboarding_step_completed',
      workspaceId,
      step,
    }).catch(() => {})
  }

  return NextResponse.json(updated)
}
