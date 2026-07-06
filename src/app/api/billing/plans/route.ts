/**
 * Issue #221: IRR billing — list available plans.
 *
 *   GET /api/billing/plans — list all active plans, cheapest first.
 *
 * Permission: any authenticated workspace member (plans are public info).
 */

import { NextResponse } from 'next/server'
import { requireWorkspaceApi } from '@/lib/auth-guards'
import { billingService, BillingError } from '@/modules/billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requireWorkspaceApi()
  if (guard.error) return guard.error
  try {
    const plans = await billingService.listPlans()
    return NextResponse.json({ data: plans })
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}