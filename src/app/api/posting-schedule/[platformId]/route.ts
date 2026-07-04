/**
 * GET/PUT /api/posting-schedule/[platformId] — per-channel queue schedule.
 * Issue #203: Queue-based scheduling (Buffer model).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { getSchedule, upsertSchedule, getNextQueueSlot } from '@/modules/scheduling/service'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ platformId: string }> }) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const { platformId } = await params
  const schedule = await getSchedule(guard.workspaceId, platformId)
  const nextSlot = schedule?.isActive ? getNextQueueSlot(schedule.schedule as Array<{ day: number; slots: string[] }>) : null
  return NextResponse.json({ schedule, nextSlot })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ platformId: string }> }) {
  const guard = await requirePermissionApi('content.create')
  if (guard.error) return guard.error
  const { platformId } = await params
  const body = await req.json().catch(() => null)
  if (!body?.schedule) return NextResponse.json({ error: 'فیلد schedule الزامی است' }, { status: 400 })
  const updated = await upsertSchedule(guard.workspaceId, { platformId, schedule: body.schedule, isActive: body.isActive ?? true })
  return NextResponse.json(updated)
}
