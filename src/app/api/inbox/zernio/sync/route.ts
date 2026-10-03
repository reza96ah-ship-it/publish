import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { syncWorkspaceZernioInbox } from '@/modules/inbox/zernio-sync'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('inbox.reply')
  if (guard.error) return guard.error
  await syncWorkspaceZernioInbox(guard.workspaceId)
  return NextResponse.json({ synced: true })
}
