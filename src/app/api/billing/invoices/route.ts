/**
 * Issue #221: IRR billing — list the workspace's invoices.
 *
 *   GET /api/billing/invoices — list invoices for the active workspace,
 *   newest first (max 50).
 *
 * Permission: billing.manage (admin-only).
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { billingService, BillingError } from '@/modules/billing'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('billing.manage')
  if (guard.error) return guard.error
  try {
    const invoices = await billingService.getInvoices({
      workspaceId: guard.workspaceId,
      userId: guard.userId,
    })
    return NextResponse.json({ data: invoices })
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
