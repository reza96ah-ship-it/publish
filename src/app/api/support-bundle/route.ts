/**
 * GET /api/support-bundle — generates a sanitized diagnostic bundle for support requests.
 *
 * Collects: recent publish job outcomes, channel health, workspace config (no secrets),
 * active member count, and platform connection status.
 *
 * NEVER includes: OAuth tokens, password hashes, MFA secrets, caption text, DM content,
 * or any personal data beyond workspace/job metadata.
 *
 * Returns a JSON file download.
 */

import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { buildSupportBundle } from '@/modules/support-bundle/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const bundle = await buildSupportBundle(guard.workspaceId)
  const filename = `nashrino-support-bundle-${new Date().toISOString().split('T')[0]}.json`

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
