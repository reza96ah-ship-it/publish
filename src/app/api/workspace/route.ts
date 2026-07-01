import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
  return NextResponse.json(ws)
}
