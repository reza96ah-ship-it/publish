/**
 * GET /api/members/invite/list — list pending invitations (Issue #143).
 *
 * Returns invitations for the current workspace. Never returns tokenHash.
 * Permission: member.invite (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requirePermissionApi } from '@/lib/auth-guards'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('member.invite')
  if (guard.error) return guard.error
  const workspaceId = guard.workspaceId

  const invitations = await db.workspaceInvitation.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      emailNormalized: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      createdAt: true,
      // NEVER select tokenHash — it must never appear in API responses
    },
  })

  const now = new Date()
  return NextResponse.json({
    data: invitations.map((inv) => ({
      id: inv.id,
      email: inv.emailNormalized,
      role: inv.role,
      status: inv.acceptedAt
        ? 'accepted'
        : inv.revokedAt
          ? 'revoked'
          : inv.expiresAt < now
            ? 'expired'
            : 'pending',
      expiresAt: inv.expiresAt.toISOString(),
      acceptedAt: inv.acceptedAt?.toISOString() ?? null,
      revokedAt: inv.revokedAt?.toISOString() ?? null,
      createdAt: inv.createdAt.toISOString(),
    })),
  })
}
