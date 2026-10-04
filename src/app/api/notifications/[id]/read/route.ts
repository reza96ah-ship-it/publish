import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateId } from '@/lib/validations'
import { notificationsService } from '@/modules/notifications'

export const dynamic = 'force-dynamic'

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requirePermissionApi('analytics.view')
  if (guard.error) return guard.error
  const { id } = await params
  const idCheck = validateId(id)
  if (!idCheck.success) return NextResponse.json({ error: idCheck.error }, { status: 400 })
  const result = await notificationsService.markRead(
    { workspaceId: guard.workspaceId, userId: guard.userId }, idCheck.data,
  )
  return NextResponse.json(result)
}
