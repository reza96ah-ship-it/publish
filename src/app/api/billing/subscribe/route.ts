/**
 * Issue #221: IRR billing — initiate Zarinpal subscription payment.
 *
 *   POST /api/billing/subscribe  body: { planCode }
 *     — creates a pending invoice, calls Zarinpal /PaymentRequest, returns
 *       { paymentUrl, authority, invoiceId }. The client should redirect to
 *       `paymentUrl` to send the user to the Zarinpal checkout page.
 *
 * Permission: billing.manage (admin-only).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requirePermissionApi } from '@/lib/auth-guards'
import { validateBody } from '@/lib/validations'
import { billingService, BillingError } from '@/modules/billing'

export const dynamic = 'force-dynamic'

const subscribeSchema = z.object({
  planCode: z.enum(['free', 'pro', 'agency', 'enterprise']),
})

function mapError(err: unknown): NextResponse {
  if (err instanceof BillingError) {
    return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
  }
  throw err
}

export async function POST(req: NextRequest) {
  const guard = await requirePermissionApi('billing.manage')
  if (guard.error) return guard.error
  const raw = await req.json().catch(() => null)
  if (!raw) return NextResponse.json({ error: 'بدنه نامعتبر است' }, { status: 400 })
  const v = validateBody(subscribeSchema, raw)
  if (!v.success) return NextResponse.json({ error: v.error }, { status: 400 })
  try {
    const result = await billingService.createSubscription(
      { workspaceId: guard.workspaceId, userId: guard.userId },
      v.data
    )
    return NextResponse.json(result)
  } catch (err) { return mapError(err) }
}
