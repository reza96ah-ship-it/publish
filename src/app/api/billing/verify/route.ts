/**
 * Issue #221: IRR billing — Zarinpal payment verification callback.
 *
 *   GET /api/billing/verify?Authority=...&Status=OK
 *     — Zarinpal redirects here after the user completes (or cancels) the
 *       payment. We verify the transaction with Zarinpal's /Verification
 *       endpoint, mark the invoice paid, and upsert the subscription.
 *
 * No auth required — this is a Zarinpal-initiated redirect. The workspace
 * is resolved from the invoice row matched by the Authority code.
 *
 * On success: redirect to /settings?billing=success.
 * On failure: redirect to /settings?billing=failed.
 */

import { NextRequest, NextResponse } from 'next/server'
import { billingService, BillingError } from '@/modules/billing'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const authority = sp.get('Authority') ?? ''
  const status = sp.get('Status') ?? ''
  if (!authority) {
    return NextResponse.redirect(new URL('/settings?billing=failed', req.url))
  }
  try {
    await billingService.verifyPayment(authority, status)
    return NextResponse.redirect(new URL('/settings?billing=success', req.url))
  } catch (err) {
    if (err instanceof BillingError) {
      const msg = encodeURIComponent(err.userMessage ?? err.message)
      return NextResponse.redirect(new URL(`/settings?billing=failed&msg=${msg}`, req.url))
    }
    return NextResponse.redirect(new URL('/settings?billing=failed', req.url))
  }
}
