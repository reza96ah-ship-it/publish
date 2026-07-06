/**
 * Feature flags settings API.
 *
 * GET  /api/flags  — resolved flags + labels for the settings panel
 * PATCH /api/flags — set a per-workspace override { flag, enabled }
 *
 * Toggling requires workspace.settings (admin) since flags gate beta
 * features workspace-wide.
 */
import { NextResponse } from 'next/server'
import { requirePermissionApi } from '@/lib/auth-guards'
import { evaluateFlags, isFlagName, setFlag, FLAG_META, type FlagName } from '@/lib/flags'

export const dynamic = 'force-dynamic'

export async function GET() {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  const resolved = await evaluateFlags(guard.workspace.id)
  const flags = (Object.keys(FLAG_META) as FlagName[]).map((name) => ({
    name,
    label: FLAG_META[name].label,
    description: FLAG_META[name].description,
    enabled: resolved[name],
  }))
  return NextResponse.json({ flags })
}

export async function PATCH(req: Request) {
  const guard = await requirePermissionApi('workspace.settings')
  if (guard.error) return guard.error

  let body: { flag?: string; enabled?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'بدنه درخواست نامعتبر است' }, { status: 400 })
  }

  const { flag, enabled } = body
  if (!flag || !isFlagName(flag) || typeof enabled !== 'boolean') {
    return NextResponse.json({ error: 'قابلیت ناشناخته است' }, { status: 400 })
  }

  await setFlag(guard.workspace.id, flag, enabled)
  return NextResponse.json({ ok: true, flag, enabled })
}
