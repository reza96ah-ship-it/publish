import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireWorkspaceApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  const workspaceId = guard.workspace.id
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
  return NextResponse.json(ws)
}
