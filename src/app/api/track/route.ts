import { NextRequest, NextResponse } from 'next/server'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { track } from '@/lib/track'
import type { NashrinoEvent } from '@/lib/events'

export const dynamic = 'force-dynamic'

// POST /api/track — client-side event bridge (plan §18).
// Accepts a partial event body, merges in workspaceId from the session,
// and forwards to track() which delivers to PostHog server-side.
// Always 200 so failed analytics never surface as user-visible errors.
export async function POST(req: NextRequest) {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error

  const body = await req.json().catch(() => null)
  if (typeof body?.event !== 'string') {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  void track({ ...body, workspaceId: guard.workspace.id } as NashrinoEvent)
  return NextResponse.json({ ok: true })
}
