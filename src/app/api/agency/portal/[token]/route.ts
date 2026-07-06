/**
 * Issue #254: Agency API — PUBLIC client portal access via token.
 *
 *   GET /api/agency/portal/[token]  — NO AUTH — validates token, returns the
 *                                     client workspace + permissions + pending
 *                                     content for portal rendering.
 *
 * The token is the credential. Validation: token exists, isActive=true, and
 * expiresAt (if set) is in the future. The proxy (`src/proxy.ts`) whitelists
 * `/api/agency/portal/` as a public path so unauthenticated requests reach
 * this handler without a session cookie.
 *
 * Next 16: `params` is a Promise.
 */

import { NextRequest, NextResponse } from 'next/server'
import { agencyService, AgencyError } from '@/modules/agency'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  if (!token || token.length < 16 || token.length > 100) {
    return NextResponse.json({ error: 'توکن نامعتبر است' }, { status: 400 })
  }
  try {
    const result = await agencyService.getPortalAccess(token)
    if (!result) {
      return NextResponse.json(
        { error: 'دسترسی پورتال یافت نشد یا منقضی شده است' },
        { status: 404 }
      )
    }
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof AgencyError) {
      return NextResponse.json({ error: err.userMessage ?? err.message }, { status: err.statusCode })
    }
    throw err
  }
}
