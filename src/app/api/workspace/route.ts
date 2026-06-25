import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getWorkspaceId } from '@/lib/server'

export async function GET() {
  const workspaceId = await getWorkspaceId()
  if (!workspaceId) return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
  return NextResponse.json(ws)
}
