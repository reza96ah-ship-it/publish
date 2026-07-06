/**
 * Issue #221: IRR billing — current plan + usage meters.
 *
 *   GET /api/billing/current — returns the workspace's current subscription,
 *   the active plan row (falls back to free when no subscription exists), and
 *   real usage counts (channels / seats / posts this month) so the settings
 *   billing tab can render usage meters without a second round-trip.
 *
 * Permission: any authenticated workspace member (so non-admins can see the
 * current plan; only billing.manage can change it).
 */

import { NextResponse } from 'next/server'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { billingService, BillingError } from '@/modules/billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  try {
    const result = await billingService.getCurrentPlan({
      workspaceId: guard.workspace.id,
      userId: guard.userId,
    })
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
